import type { Prisma, Task } from "@prisma/client";
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
  "id" | "status" | "workstreamId" | "assignedAgentId" | "revisionCount" | "maxRevisions"
> & { workerOwnerId: string | null };
export type CommentActor =
  | { type: "user"; id: string; coordinator: boolean }
  | { type: "agent"; id: string; ownerId: string };

export interface TaskCommentStore {
  findTask(id: string): Promise<CommentTask | null>;
  changeTask(task: CommentTask, data: Prisma.TaskUncheckedUpdateManyInput): Promise<boolean>;
  createComment(data: Prisma.TaskCommentUncheckedCreateInput): Promise<SavedTaskComment>;
  countReviewsSinceLastDelivery?(taskId: string): Promise<number>;
}

type CommentInput = z.infer<typeof commentCreateSchema>;

export class TaskCommentError extends Error {
  constructor(message: string, readonly status: number, readonly details?: Record<string, string[]>) {
    super(message);
  }
}

export function isReviewCoordinator(userId: string, configuredIds = process.env.REVIEW_COORDINATOR_USER_IDS) {
  return (configuredIds ?? "").split(",").some((id) => id.trim() === userId && userId.length > 0);
}

export function serializeTaskComment(comment: SavedTaskComment) {
  return {
    ...comment,
    authorAgent: comment.authorAgent ? serializeAgentRef(comment.authorAgent) : null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

/** Called inside one transaction: a failed comment insert must roll back its state change. */
export async function writeTaskComment(
  store: TaskCommentStore,
  actor: CommentActor,
  taskId: string,
  input: CommentInput,
) {
  const task = await store.findTask(taskId);
  if (!task) throw new TaskCommentError("Not found", 404);

  let change: Prisma.TaskUncheckedUpdateManyInput | undefined;

  if (input.type === "revision_request") {
    if (actor.type === "user" && !actor.coordinator) {
      throw new TaskCommentError("Only a Review Coordinator or peer reviewer can request revisions", 403);
    }
    if (!task.workstreamId || !task.assignedAgentId || !task.workerOwnerId) {
      throw new TaskCommentError("Revisions require a workstream task with an assigned worker", 400);
    }
    if (actor.type === "agent" &&
      (actor.id === task.assignedAgentId || actor.ownerId === task.workerOwnerId)) {
      throw new TaskCommentError("Revision reviewers must belong to a different user than the worker", 403);
    }
    if (task.status !== "submitted" && task.status !== "in_review") {
      throw new TaskCommentError("Task must be submitted or in review to request revisions", 400);
    }

    // The stored default is two; never allow a larger value to bypass the PRD's cap.
    const revisionLimit = Math.min(task.maxRevisions, 2);
    change = task.revisionCount < revisionLimit
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

  if (input.type === "bid" && (task.status === "open" || task.status === "reopened")) {
    change = { status: "bidding" };
  }

  if (input.type === "review") {
    if (task.status !== "submitted" && task.status !== "in_review") {
      throw new TaskCommentError("Task is not in a reviewable state", 400);
    }
    if (task.assignedAgentId && actor.type === "agent" && actor.id === task.assignedAgentId) {
      throw new TaskCommentError("Assigned worker cannot review their own task", 403);
    }
    if (store.countReviewsSinceLastDelivery) {
      const reviewCount = await store.countReviewsSinceLastDelivery(taskId);
      if (reviewCount >= 4) {
        throw new TaskCommentError("Maximum 4 peer reviews per delivery round reached", 400);
      }
    }
  }

  if (change && !await store.changeTask(task, change)) {
    throw new TaskCommentError("Task changed while posting the comment; reload and try again", 409);
  }

  return store.createComment({
    taskId,
    type: input.type,
    tag: input.tag ?? null,
    title: input.title ?? null,
    body: input.body,
    attachment: input.attachment ?? null,
    score: input.score ?? null,
    authorAgentId: actor.type === "agent" ? actor.id : null,
    authorUserId: actor.type === "user" ? actor.id : null,
  });
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
