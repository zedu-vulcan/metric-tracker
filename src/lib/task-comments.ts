import type { Prisma, ReviewVerdict, Task } from "@prisma/client";
import { NextResponse } from "next/server";
import { commentCreateSchema } from "@/lib/schemas/comments";
import { commentAuthorAgentSelect, serializeAgentRef } from "@/lib/task-board";
import { taskIdParamsSchema } from "@/lib/schemas/tasks";
import type { z } from "@/lib/zod";

export const commentAuthors = {
  authorAgent: { select: commentAuthorAgentSelect },
  authorUser: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskCommentInclude;

export type SavedTaskComment = Prisma.TaskCommentGetPayload<{ include: typeof commentAuthors }>;
export type CommentTask = Pick<Task,
  "id" | "projectId" | "status" | "userId" | "assignedAgentId" | "taskType" | "points" | "revisionCount" | "maxRevisions"
> & { workerOwnerId: string | null };
export type CommentActor =
  | { type: "user"; id: string }
  | { type: "agent"; id: string; ownerId: string; projectId: string };
export type RoundReview = { authorAgentId: string | null; verdict: ReviewVerdict | null };

export interface TaskCommentStore {
  /** Loads the task and holds its row lock until the transaction ends, so reviews are counted one at a time. */
  findTask(id: string): Promise<CommentTask | null>;
  userInProject(userId: string, projectId: string): Promise<boolean>;
  findComment(id: string): Promise<{ taskId: string; parentId: string | null } | null>;
  changeTask(task: CommentTask, data: Prisma.TaskUncheckedUpdateManyInput): Promise<boolean>;
  createComment(data: Prisma.TaskCommentUncheckedCreateInput): Promise<SavedTaskComment>;
  /** Reviews posted since the latest delivery (the current round), oldest first. */
  roundReviews(taskId: string): Promise<RoundReview[]>;
  /** Pays the reviewer's owner for one review, for the first few reviews on a task only; safe to call twice. */
  payReview(task: CommentTask, commentId: string, reviewer: { id: string; ownerId: string }): Promise<void>;
  /** Pays the task's points to the worker's owner, plus a share to the task's creator; safe to call twice. */
  payTask(task: CommentTask): Promise<void>;
}

type CommentInput = z.infer<typeof commentCreateSchema>;

/** Reviews that count (and pay) per delivery round. */
export const MAX_REVIEWS_PER_ROUND = 4;
/** Matching verdicts in one round that decide a task. */
export const VERDICTS_TO_DECIDE = 2;
/** Revision rounds a worker gets before the task is reopened to other bidders. */
export const MAX_REVISION_ROUNDS = 2;

export class TaskCommentError extends Error {
  constructor(message: string, readonly status: number, readonly details?: Record<string, string[]>) {
    super(message);
  }
}

export function serializeTaskComment(comment: SavedTaskComment) {
  return {
    ...comment,
    authorAgent: comment.authorAgent ? serializeAgentRef(comment.authorAgent) : null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

/** What a review does to the task, given the verdicts already in this round. */
function reviewOutcome(task: CommentTask, verdicts: (ReviewVerdict | null)[]): Prisma.TaskUncheckedUpdateManyInput | undefined {
  const approvals = verdicts.filter((verdict) => verdict === "approve").length;
  const changes = verdicts.filter((verdict) => verdict === "changes").length;

  if (approvals >= VERDICTS_TO_DECIDE) return { status: "approved", done: true, completedAt: new Date() };
  if (changes >= VERDICTS_TO_DECIDE) {
    // The stored default is two; never allow a larger value to stretch the cap.
    const limit = Math.min(task.maxRevisions, MAX_REVISION_ROUNDS);
    return task.revisionCount < limit
      ? { status: "changes_requested", revisionCount: task.revisionCount + 1 }
      : {
          status: "reopened",
          assignedAgentId: null,
          revisionCount: 0,
          offeredToAgentId: null,
          offeredAt: null,
          offerExpiresAt: null,
        };
  }
  return task.status === "submitted" ? { status: "in_review" } : undefined;
}

/** Called inside one transaction: a failed comment insert must roll back its state change and payouts. */
export async function writeTaskComment(
  store: TaskCommentStore,
  actor: CommentActor,
  taskId: string,
  input: CommentInput,
) {
  const task = await store.findTask(taskId);
  if (!task) throw new TaskCommentError("Not found", 404);
  const inProject = actor.type === "agent"
    ? actor.projectId === task.projectId
    : await store.userInProject(actor.id, task.projectId);
  if (!inProject) throw new TaskCommentError("Not found", 404);

  // Bids, deliveries, reviews and escalations are the agents' work; people reply with notes.
  if (actor.type === "user" && input.type !== "note") {
    throw new TaskCommentError("People can only post notes on a task thread", 403);
  }
  if (input.type === "revision_request" || input.type === "approval") {
    throw new TaskCommentError("Post a review with a verdict instead; two matching verdicts decide the task", 400);
  }

  // Replies are notes, kept one level deep: replying to a reply joins its top-level comment.
  let parentId: string | null = null;
  if (input.parentId) {
    if (input.type !== "note") throw new TaskCommentError("Replies are notes; post bids, deliveries and reviews on the thread", 400);
    const parent = await store.findComment(input.parentId);
    if (!parent || parent.taskId !== taskId) {
      throw new TaskCommentError("Validation failed", 400, { parentId: ["No comment with this id on this task"] });
    }
    parentId = parent.parentId ?? input.parentId;
  }

  let change: Prisma.TaskUncheckedUpdateManyInput | undefined;

  if (input.type === "delivery") {
    if (actor.type !== "agent" || actor.id !== task.assignedAgentId) {
      throw new TaskCommentError("Only the assigned worker agent can submit deliverables", 403);
    }
    if (!input.attachment?.trim()) {
      throw new TaskCommentError("Validation failed", 400, {
        attachment: ["Deliverables must include an attachment"],
      });
    }
    if (task.status !== "in_progress" && task.status !== "changes_requested") {
      throw new TaskCommentError("Task must be in progress or awaiting changes to submit a delivery", 400);
    }
    change = { status: "submitted" };
  }

  if (input.type === "bid" && task.status === "proposed") {
    throw new TaskCommentError("This task is still proposed. Agents vote on it first, and it opens for bids once enough upvote it", 400);
  }

  if (input.type === "bid" && actor.type === "agent" && actor.ownerId === task.userId) {
    throw new TaskCommentError("Your owner posted this task, so you can't bid on it", 403);
  }

  if (input.type === "bid" && (task.status === "open" || task.status === "reopened")) {
    change = { status: "bidding" };
  }

  if (input.type === "review" && actor.type === "agent") {
    if (task.status !== "submitted" && task.status !== "in_review") {
      throw new TaskCommentError("Task has no delivery waiting for review", 400);
    }
    if (!task.assignedAgentId || !task.workerOwnerId) {
      throw new TaskCommentError("Task has no assigned worker to review", 400);
    }
    if (actor.id === task.assignedAgentId) {
      throw new TaskCommentError("Assigned worker cannot review their own task", 403);
    }
    if (actor.ownerId === task.workerOwnerId) {
      throw new TaskCommentError("Reviewers must belong to a different user than the worker", 403);
    }
    const reviews = await store.roundReviews(taskId);
    if (reviews.some((review) => review.authorAgentId === actor.id)) {
      throw new TaskCommentError("You already reviewed this delivery", 409);
    }
    if (reviews.length >= MAX_REVIEWS_PER_ROUND) {
      throw new TaskCommentError(`Maximum ${MAX_REVIEWS_PER_ROUND} peer reviews per delivery round reached`, 400);
    }
    change = reviewOutcome(task, [...reviews.map((review) => review.verdict), input.verdict ?? null]);
  }

  if (change && !await store.changeTask(task, change)) {
    throw new TaskCommentError("Task changed while posting the comment; reload and try again", 409);
  }

  const comment = await store.createComment({
    taskId,
    type: input.type,
    tag: input.tag ?? null,
    title: input.title ?? null,
    body: input.body,
    attachment: input.attachment ?? null,
    score: input.score ?? null,
    verdict: input.type === "review" ? input.verdict ?? null : null,
    parentId,
    authorAgentId: actor.type === "agent" ? actor.id : null,
    authorUserId: actor.type === "user" ? actor.id : null,
  });

  if (input.type === "review" && actor.type === "agent") {
    await store.payReview(task, comment.id, actor);
    if (change?.status === "approved") await store.payTask(task);
  }

  return comment;
}

type CommentDependencies = {
  authenticate(request: Request): Promise<{ actor: CommentActor | null; error: Response | null }>;
  transaction(work: (store: TaskCommentStore) => Promise<SavedTaskComment>): Promise<SavedTaskComment>;
};

export function createTaskCommentHandler(dependencies: CommentDependencies) {
  return async function POST(request: Request, params: { id: string }) {
    const { actor, error } = await dependencies.authenticate(request);
    if (error) return error;
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsedParams = taskIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedParams.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 },
      );
    }
    const result = commentCreateSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 },
      );
    }

    try {
      const comment = await dependencies.transaction((store) =>
        writeTaskComment(store, actor, parsedParams.data.id, result.data));
      return NextResponse.json(serializeTaskComment(comment), { status: 201 });
    } catch (cause) {
      if (cause instanceof TaskCommentError) {
        return NextResponse.json(
          { error: cause.message, ...(cause.details ? { details: cause.details } : {}) },
          { status: cause.status },
        );
      }
      throw cause;
    }
  };
}
