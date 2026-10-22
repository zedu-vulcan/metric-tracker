import { prisma } from "@/lib/prisma";

export type WorkItemType = "idea" | "task";

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
  title: string;
  type: WorkItemType;
  status: string; // e.g. "PROPOSED", "BID_PLACED", "IN_PROGRESS", "APPROVED", "ACCEPTED", etc.
  points: number | null;
  updatedAt: string; // ISO 8601 string
  breadcrumbs: {
    goalTitle: string;
    workstreamTitle?: string;
  };
  goalId: string;
  workstreamId?: string;
  goalTitle: string;
  workstreamTitle?: string;
  agent?: {
    id: string;
    name: string;
    avatarStyle: string;
    avatarSeed: string;
  } | null;
}

/**
 * Maps raw database statuses across Ideas and Tasks to specific UI tabs:
 * - PROPOSED / BID_PLACED -> Applied
 * - ACCEPTED (ideas) / APPROVED (tasks) -> Approved
 * - IN_PROGRESS -> In progress
 * - OFFERED -> Offered
 * - SUBMITTED / IN_REVIEW -> In review
 * - CHANGES_REQUESTED -> Changes requested
 * - REJECTED / DECLINED / LOST -> Lost / declined
 */
export function mapStatusToTab(rawStatus: string, type?: WorkItemType): WorkTab {
  const s = rawStatus.toLowerCase().trim();

  // Ideas-specific mappings
  if (type === "idea") {
    if (s === "proposed") return "applied";
    if (s === "accepted") return "approved";
    if (s === "rejected") return "lost";
  }

  // Tasks and general mappings
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
export function getWorkItemTab(item: Pick<UnifiedWorkItem, "status" | "type">): WorkTab {
  return mapStatusToTab(item.status, item.type);
}

export type RawIdeaRecord = {
  id: string;
  title: string;
  status: string;
  goalId: string;
  updatedAt: Date | string;
  goal?: { id: string; title: string } | null;
  proposedByAgent?: {
    id: string;
    name: string;
    avatarStyle: string;
    avatarSeed: string;
  } | null;
};

export type RawTaskRecord = {
  id: string;
  title: string;
  status: string;
  points: number | null;
  updatedAt: Date | string;
  workstream?: {
    id: string;
    title: string;
    goal?: { id: string; title: string } | null;
  } | null;
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
 * Normalizes raw Idea and Task records into a sorted, flat UnifiedWorkItem array.
 */
export function normalizeWorkItems(
  ideas: RawIdeaRecord[],
  tasks: RawTaskRecord[],
  userId: string
): UnifiedWorkItem[] {
  const ideaItems: UnifiedWorkItem[] = ideas.map((idea) => {
    const goalTitle = idea.goal?.title ?? "Goal unavailable";
    const updatedAtIso = typeof idea.updatedAt === "string" ? idea.updatedAt : idea.updatedAt.toISOString();
    return {
      id: idea.id,
      title: idea.title,
      type: "idea",
      status: idea.status.toUpperCase(),
      points: idea.status.toLowerCase() === "accepted" ? 3 : null,
      updatedAt: updatedAtIso,
      breadcrumbs: {
        goalTitle,
      },
      goalId: idea.goalId,
      goalTitle,
      agent: idea.proposedByAgent
        ? {
            id: idea.proposedByAgent.id,
            name: idea.proposedByAgent.name,
            avatarStyle: idea.proposedByAgent.avatarStyle,
            avatarSeed: idea.proposedByAgent.avatarSeed,
          }
        : null,
    };
  });

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

    const goalTitle = task.workstream?.goal?.title ?? "Goal unavailable";
    const workstreamTitle = task.workstream?.title ?? "Workstream unavailable";
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
          title: task.title,
          type: "task" as const,
          status: rawStatus,
          points: task.points,
          updatedAt: updatedAtIso,
          breadcrumbs: {
            goalTitle,
            workstreamTitle,
          },
          goalId: task.workstream?.goal?.id ?? "",
          workstreamId: task.workstream?.id ?? "",
          goalTitle,
          workstreamTitle,
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

  return [...ideaItems, ...taskItems].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Server-side data fetching function that queries the Prisma database for ALL
 * work items (Ideas/Workstreams and Tasks/Bids) tied to the current logged-in user's agents.
 */
export async function getUnifiedWorkItems(projectId: string, userId: string): Promise<UnifiedWorkItem[]> {
  // Query 1: Ideas / Approaches proposed by user's agents
  const ideas = await prisma.workstream.findMany({
    where: {
      proposedByAgent: {
        ownerId: userId,
        projectId,
      },
      goal: {
        projectId,
      },
    },
    include: {
      goal: {
        select: {
          id: true,
          title: true,
        },
      },
      proposedByAgent: {
        select: {
          id: true,
          name: true,
          avatarStyle: true,
          avatarSeed: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Query 2: Tasks where user's agents are assigned, offered, or have placed bids/comments
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
      workstream: {
        include: {
          goal: { select: { id: true, title: true } },
        },
      },
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

  return normalizeWorkItems(ideas, tasks, userId);
}

