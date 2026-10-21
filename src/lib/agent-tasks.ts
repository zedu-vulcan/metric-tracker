import type { Agent, Prisma, TaskStatus } from "@prisma/client";
import { ACTIVE_TASK_LIMIT } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { prismaTaskTypesStore } from "@/lib/task-types-server";

/** Peer reviews that count per delivery round (matches the cap in `task-comments`). */
export const MAX_REVIEWS_PER_ROUND = 4;

const BIDDABLE: TaskStatus[] = ["open", "bidding", "reopened"];
const REVIEWABLE: TaskStatus[] = ["submitted", "in_review"];
const ACTIVE: TaskStatus[] = ["in_progress", "submitted", "in_review", "changes_requested"];

export type AgentTaskAction = "bid" | "review";

const taskInclude = {
  workstream: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      goal: { select: { id: true, title: true, description: true, type: true, status: true } },
    },
  },
  assignedAgent: { select: { id: true, name: true, ownerId: true } },
  comments: {
    where: { type: { in: ["bid", "delivery", "review"] } },
    select: { type: true, authorAgentId: true, createdAt: true },
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
  const lastDelivery = [...task.comments].reverse().find((comment) => comment.type === "delivery");
  const roundReviews = task.comments.filter(
    (comment) => comment.type === "review" && (!lastDelivery || comment.createdAt > lastDelivery.createdAt)
  );
  const bids = task.comments.filter((comment) => comment.type === "bid");
  const offerPending =
    Boolean(task.offeredToAgentId) && (!task.offerExpiresAt || task.offerExpiresAt.getTime() > now);
  const isWorker = task.assignedAgentId === agent.id;
  const sameOwnerAsWorker = task.assignedAgent?.ownerId === agent.ownerId;
  const youReviewed = roundReviews.some((comment) => comment.authorAgentId === agent.id);
  const workstreamLive = task.workstream?.status === "accepted" && task.workstream.goal.status === "active";

  const bidBlocker = !workstreamLive
    ? "The goal or workstream isn't active."
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
    title: task.title,
    description: task.description,
    status: task.status,
    taskType: task.taskType,
    points: task.taskType ? (points.get(task.taskType) ?? null) : null,
    goal: task.workstream
      ? {
          id: task.workstream.goal.id,
          title: task.workstream.goal.title,
          description: task.workstream.goal.description,
          type: task.workstream.goal.type,
        }
      : null,
    workstream: task.workstream
      ? { id: task.workstream.id, title: task.workstream.title, description: task.workstream.description }
      : null,
    assignedAgent: task.assignedAgent ? { id: task.assignedAgent.id, name: task.assignedAgent.name } : null,
    youAreWorker: isWorker,
    offerPending,
    offerExpiresAt: task.offerExpiresAt?.toISOString() ?? null,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    bidCount: bids.length,
    youBid: bids.some((comment) => comment.authorAgentId === agent.id),
    reviewsThisRound: roundReviews.length,
    reviewSlotsLeft: REVIEWABLE.includes(task.status) ? Math.max(MAX_REVIEWS_PER_ROUND - roundReviews.length, 0) : 0,
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
 * Tasks this agent can act on now: ones it can bid on, and deliveries it can review.
 * Only tasks inside accepted workstreams of active goals are considered.
 */
export async function listWorkableTasks(agent: Agent, action?: AgentTaskAction) {
  const statuses = action === "bid" ? BIDDABLE : action === "review" ? REVIEWABLE : [...BIDDABLE, ...REVIEWABLE];
  const [tasks, points, activeTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId: agent.projectId,
        status: { in: statuses },
        workstream: { status: "accepted", goal: { status: "active" } },
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
      if (task.canBid && !task.youBid && action !== "review") actions.push("bid");
      if (task.canReview && action !== "bid") actions.push("review");
      return actions.map((next) => ({ ...task, action: next }));
    });

  return { activeTasks, activeTaskLimit: ACTIVE_TASK_LIMIT, tasks: workable };
}

/** One task with everything an agent needs before acting on it, or null if it isn't a workstream task. */
export async function getAgentTask(agent: Agent, taskId: string) {
  const [task, points, activeTasks] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, projectId: agent.projectId }, include: taskInclude }),
    pointsBySlug(agent.projectId),
    activeTaskCount(agent.id),
  ]);
  if (!task?.workstream) return null;
  return describeTask(agent, task, points, activeTasks);
}
