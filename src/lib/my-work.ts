import { prisma } from "@/lib/prisma";
import { formatRef } from "@/lib/refs";

export type WorkTab =
  | "applied"
  | "offered"
  | "in_progress"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "lost";

export interface UnifiedWorkItem {
  id: string;
  /** Short reference, e.g. T-341. */
  ref: string;
  title: string;
  status: string; // e.g. "BID_PLACED", "IN_PROGRESS", "APPROVED", etc.
  points: number | null;
  updatedAt: string; // ISO 8601 string
  agent?: {
    id: string;
    name: string;
    avatarStyle: string;
    avatarSeed: string;
  } | null;
}

/**
 * Maps raw task statuses to specific UI tabs:
 * - PROPOSED / BID_PLACED -> Applied
 * - APPROVED -> Approved
 * - IN_PROGRESS -> In progress
 * - OFFERED -> Offered
 * - SUBMITTED / IN_REVIEW -> In review
 * - CHANGES_REQUESTED -> Changes requested
 * - REJECTED / DECLINED / LOST -> Lost / declined
 */
export function mapStatusToTab(rawStatus: string): WorkTab {
  const s = rawStatus.toLowerCase().trim();

  switch (s) {
    case "proposed":
    case "bid_placed":
    case "applied":
    case "bidding":
    case "open":
      return "applied";

    case "offered":
      return "offered";

    case "in_progress":
      return "in_progress";

    case "submitted":
    case "in_review":
      return "in_review";

    case "changes_requested":
      return "changes_requested";

    case "accepted":
    case "approved":
      return "approved";

    case "rejected":
    case "declined":
    case "lost":
      return "lost";

    default:
      return "applied";
  }
}

/**
 * Helper to get the active UI tab for any unified work item.
 */
export function getWorkItemTab(item: Pick<UnifiedWorkItem, "status">): WorkTab {
  return mapStatusToTab(item.status);
}

export type RawTaskRecord = {
  id: string;
  number: number;
  title: string;
  status: string;
  points: number | null;
  updatedAt: Date | string;
  assignedAgent?: {
    id: string;
    ownerId?: string | null;
    name: string;
    avatarStyle: string;
    avatarSeed: string;
  } | null;
  offeredToAgent?: {
    id: string;
    ownerId?: string | null;
    name: string;
    avatarStyle: string;
    avatarSeed: string;
  } | null;
  comments?: Array<{
    type: string;
    title?: string | null;
    authorAgentId?: string | null;
    authorAgent?: {
      id: string;
      name: string;
      avatarStyle: string;
      avatarSeed: string;
    } | null;
  }>;
};

/**
 * Normalizes raw task records into a sorted, flat UnifiedWorkItem array, one entry per agent of yours involved.
 */
export function normalizeWorkItems(tasks: RawTaskRecord[], userId: string): UnifiedWorkItem[] {
  const taskItems: UnifiedWorkItem[] = tasks.flatMap((task) => {
    const agents = new Map<string, { id: string; name: string; avatarStyle: string; avatarSeed: string }>();

    for (const comment of task.comments ?? []) {
      if (comment.authorAgent) {
        agents.set(comment.authorAgent.id, comment.authorAgent);
      }
    }
    if (task.assignedAgent?.ownerId === userId) {
      agents.set(task.assignedAgent.id, task.assignedAgent);
    }
    if (task.offeredToAgent?.ownerId === userId) {
      agents.set(task.offeredToAgent.id, task.offeredToAgent);
    }

    const updatedAtIso = typeof task.updatedAt === "string" ? task.updatedAt : task.updatedAt.toISOString();

    return [...agents.values()].flatMap((agent) => {
      const bid = (task.comments ?? []).some(
        (comment) => comment.type === "bid" && comment.authorAgentId === agent.id
      );
      const declined = (task.comments ?? []).some(
        (comment) => comment.title === "Declined the offer" && comment.authorAgentId === agent.id
      );
      const isAssigned = task.assignedAgent?.id === agent.id;
      const isOffered = task.offeredToAgent?.id === agent.id;

      let rawStatus: string;
      if (isAssigned) {
        rawStatus = task.status.toUpperCase();
      } else if (isOffered) {
        rawStatus = "OFFERED";
      } else if (declined || (bid && task.offeredToAgent && task.offeredToAgent.id !== agent.id)) {
        rawStatus = "LOST";
      } else if (bid && ["open", "bidding", "reopened"].includes(task.status.toLowerCase())) {
        rawStatus = "BID_PLACED";
      } else if (bid) {
        rawStatus = "LOST";
      } else {
        return [];
      }

      return [
        {
          id: task.id,
          ref: formatRef(task.number),
          title: task.title,
          status: rawStatus,
          points: task.points,
          updatedAt: updatedAtIso,
          agent: {
            id: agent.id,
            name: agent.name,
            avatarStyle: agent.avatarStyle,
            avatarSeed: agent.avatarSeed,
          },
        },
      ];
    });
  });

  return taskItems.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Server-side data fetching function that queries the Prisma database for ALL
 * tasks tied to the current logged-in user's agents.
 */
export async function getUnifiedWorkItems(projectId: string, userId: string): Promise<UnifiedWorkItem[]> {
  // Tasks where the user's agents are assigned, offered, or have placed bids/comments
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      OR: [
        { assignedAgent: { ownerId: userId } },
        { offeredToAgent: { ownerId: userId } },
        {
          comments: {
            some: {
              authorAgent: { ownerId: userId },
              OR: [
                { type: { in: ["bid", "delivery", "review", "revision_request", "approval"] } },
                { title: "Declined the offer" },
              ],
            },
          },
        },
      ],
    },
    include: {
      assignedAgent: {
        select: { id: true, ownerId: true, name: true, avatarStyle: true, avatarSeed: true },
      },
      offeredToAgent: {
        select: { id: true, ownerId: true, name: true, avatarStyle: true, avatarSeed: true },
      },
      comments: {
        where: {
          authorAgent: { ownerId: userId },
          OR: [
            { type: { in: ["bid", "delivery", "review", "revision_request", "approval"] } },
            { title: "Declined the offer" },
          ],
        },
        select: {
          type: true,
          title: true,
          authorAgentId: true,
          authorAgent: {
            select: { id: true, name: true, avatarStyle: true, avatarSeed: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return normalizeWorkItems(tasks, userId);
}


// ─── Created-by-user view ────────────────────────────────────────────────────

export interface CreatedWorkItem {
  id: string;
  /** Short reference, e.g. T-341. */
  ref: string;
  title: string;
  status: string;
  points: number | null;
  updatedAt: string; // ISO 8601
  bidCount: number;
  /** Null when not yet assigned. */
  assignedAgent?: {
    id: string;
    name: string;
    avatarStyle: string;
    avatarSeed: string;
  } | null;
}

/**
 * Server-side fetch: every task the current user created in this project,
 * with bid count and assigned-agent info, newest first.
 */
export async function getCreatedWorkItems(
  projectId: string,
  userId: string
): Promise<CreatedWorkItem[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId, userId },
    include: {
      assignedAgent: {
        select: { id: true, name: true, avatarStyle: true, avatarSeed: true },
      },
      _count: { select: { comments: { where: { type: "bid" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return tasks.map((task) => ({
    id: task.id,
    ref: formatRef(task.number),
    title: task.title,
    status: task.status,
    points: task.points,
    updatedAt: task.updatedAt.toISOString(),
    bidCount: task._count.comments,
    assignedAgent: task.assignedAgent
      ? {
          id: task.assignedAgent.id,
          name: task.assignedAgent.name,
          avatarStyle: task.assignedAgent.avatarStyle,
          avatarSeed: task.assignedAgent.avatarSeed,
        }
      : null,
  }));
}
