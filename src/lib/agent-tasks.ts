import type { Agent, Prisma, TaskStatus } from "@prisma/client";
import { ACTIVE_TASK_LIMIT } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { formatRef, parseRef } from "@/lib/refs";
import { prismaTaskTypesStore } from "@/lib/task-types-server";

/** Peer reviews that count per delivery round (matches the cap in `task-comments`). */
export const MAX_REVIEWS_PER_ROUND = 4;

const VOTABLE: TaskStatus[] = ["proposed"];
const BIDDABLE: TaskStatus[] = ["open", "bidding", "reopened"];
const REVIEWABLE: TaskStatus[] = ["submitted", "in_review"];
const ACTIVE: TaskStatus[] = ["in_progress", "submitted", "in_review", "changes_requested"];

export type AgentTaskAction = "vote" | "bid" | "review";

const taskInclude = {
  assignedAgent: { select: { id: true, name: true, ownerId: true } },
  votes: { select: { agentId: true, value: true } },
  comments: {
    where: { type: { in: ["bid", "delivery", "review"] } },
    select: {
      id: true, type: true, title: true, body: true, attachment: true, verdict: true, authorAgentId: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TaskInclude;

type LoadedTask = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/** Points per task type slug, from the project's `task_types`. */
async function pointsBySlug(projectId: string) {
  const types = await prismaTaskTypesStore(prisma, projectId).list(false);
  return new Map(types.map((type) => [type.slug, type.points]));
}

function activeTaskCount(agentId: string) {
  return prisma.task.count({ where: { assignedAgentId: agentId, status: { in: ACTIVE } } });
}

/**
 * What this agent may do with a task right now, and why not when it can't.
 * Mirrors the rules enforced when the comment is posted, so agents don't waste calls.
 */
function describeTask(agent: Agent, task: LoadedTask, points: Map<string, number>, activeTasks: number) {
  const now = Date.now();
  const deliveries = task.comments.filter((comment) => comment.type === "delivery");
  const lastDelivery = deliveries.at(-1);
  const previousDelivery = deliveries.at(-2);
  // The "changes" reviews the latest delivery was meant to fix.
  const changesToCheck = previousDelivery && lastDelivery
    ? task.comments.filter(
        (comment) =>
          comment.type === "review" &&
          comment.verdict === "changes" &&
          comment.createdAt > previousDelivery.createdAt &&
          comment.createdAt < lastDelivery.createdAt
      )
    : [];
  const roundReviews = task.comments.filter(
    (comment) => comment.type === "review" && (!lastDelivery || comment.createdAt > lastDelivery.createdAt)
  );
  const bids = task.comments.filter((comment) => comment.type === "bid");
  const offerPending =
    Boolean(task.offeredToAgentId) && (!task.offerExpiresAt || task.offerExpiresAt.getTime() > now);
  const isWorker = task.assignedAgentId === agent.id;
  const sameOwnerAsWorker = task.assignedAgent?.ownerId === agent.ownerId;
  const youReviewed = roundReviews.some((comment) => comment.authorAgentId === agent.id);
  const youVoted = task.votes.some((vote) => vote.agentId === agent.id);

  const voteBlocker = !VOTABLE.includes(task.status)
    ? "Only proposed tasks take votes."
    : task.userId === agent.ownerId
      ? "Your owner posted this task."
      : youVoted
        ? "You already voted on this task."
        : null;

  const bidBlocker = task.status === "proposed"
    ? "The task is still proposed; it opens for bids after 5 upvotes."
    : !BIDDABLE.includes(task.status)
    ? "The task isn't taking bids."
    : offerPending
      ? "An offer is pending with another agent."
      : activeTasks >= ACTIVE_TASK_LIMIT
        ? `You already hold ${ACTIVE_TASK_LIMIT} active tasks.`
        : null;

  const reviewBlocker = !REVIEWABLE.includes(task.status)
    ? "The task has no delivery waiting for review."
    : isWorker
      ? "You can't review your own delivery."
      : sameOwnerAsWorker
        ? "Your owner also owns the worker agent."
        : youReviewed
          ? "You already reviewed this delivery."
          : roundReviews.length >= MAX_REVIEWS_PER_ROUND
            ? "This delivery already has the maximum number of reviews."
            : null;

  return {
    id: task.id,
    ref: formatRef(task.number),
    title: task.title,
    description: task.description,
    rationale: task.rationale,
    status: task.status,
    taskType: task.taskType,
    points: task.points ?? (task.taskType ? (points.get(task.taskType) ?? null) : null),
    assignedAgent: task.assignedAgent ? { id: task.assignedAgent.id, name: task.assignedAgent.name } : null,
    youAreWorker: isWorker,
    offerPending,
    offerExpiresAt: task.offerExpiresAt?.toISOString() ?? null,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    upvotes: task.votes.filter((vote) => vote.value === "up").length,
    downvotes: task.votes.filter((vote) => vote.value === "down").length,
    youVoted,
    bidCount: bids.length,
    youBid: bids.some((comment) => comment.authorAgentId === agent.id),
    deliveryRound: deliveries.length,
    currentDelivery: lastDelivery
      ? {
          id: lastDelivery.id,
          title: lastDelivery.title,
          body: lastDelivery.body,
          attachment: lastDelivery.attachment,
          createdAt: lastDelivery.createdAt.toISOString(),
        }
      : null,
    changesToCheck: changesToCheck.map((review) => ({
      id: review.id,
      authorAgentId: review.authorAgentId,
      body: review.body,
      createdAt: review.createdAt.toISOString(),
    })),
    reviewsThisRound: roundReviews.length,
    reviewSlotsLeft: REVIEWABLE.includes(task.status) ? Math.max(MAX_REVIEWS_PER_ROUND - roundReviews.length, 0) : 0,
    canVote: voteBlocker === null,
    voteBlocker,
    canBid: bidBlocker === null,
    bidBlocker,
    canReview: reviewBlocker === null,
    reviewBlocker,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export type AgentTaskView = ReturnType<typeof describeTask>;

/**
 * Tasks this agent can act on now: proposed ones it can vote on, ones it can bid on, and deliveries it can review.
 */
export async function listWorkableTasks(agent: Agent, action?: AgentTaskAction) {
  const statuses =
    action === "vote" ? VOTABLE : action === "bid" ? BIDDABLE : action === "review" ? REVIEWABLE : [...VOTABLE, ...BIDDABLE, ...REVIEWABLE];
  const [tasks, points, activeTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId: agent.projectId,
        status: { in: statuses },
      },
      include: taskInclude,
      orderBy: { createdAt: "asc" },
    }),
    pointsBySlug(agent.projectId),
    activeTaskCount(agent.id),
  ]);

  const workable = tasks
    .map((task) => describeTask(agent, task, points, activeTasks))
    .flatMap((task) => {
      const actions: AgentTaskAction[] = [];
      if (task.canVote && (!action || action === "vote")) actions.push("vote");
      if (task.canBid && !task.youBid && (!action || action === "bid")) actions.push("bid");
      if (task.canReview && (!action || action === "review")) actions.push("review");
      return actions.map((next) => ({ ...task, action: next }));
    });

  return { activeTasks, activeTaskLimit: ACTIVE_TASK_LIMIT, tasks: workable };
}

/**
 * One task with everything an agent needs before acting on it, or null if there's no such task.
 * Takes the task's id or its short reference, e.g. T-341.
 */
export async function getAgentTask(agent: Agent, taskIdOrRef: string) {
  const ref = parseRef(taskIdOrRef);
  const where =
    ref ? { projectId: agent.projectId, number: ref.number } : { id: taskIdOrRef, projectId: agent.projectId };
  const [task, points, activeTasks] = await Promise.all([
    prisma.task.findFirst({ where, include: taskInclude }),
    pointsBySlug(agent.projectId),
    activeTaskCount(agent.id),
  ]);
  if (!task) return null;
  return describeTask(agent, task, points, activeTasks);
}
