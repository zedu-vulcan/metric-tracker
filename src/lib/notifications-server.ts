import { prisma } from "@/lib/prisma";
import { NOTIFICATION_WINDOW_DAYS, buildNotifications, type NotificationFeed } from "@/lib/notifications";
import type { NotificationList } from "@/lib/schemas/notifications";

const DAY_MS = 24 * 60 * 60 * 1000;

const taskSelect = { id: true, title: true, workstreamId: true, workstream: { select: { goalId: true } } } as const;

type TaskRow = { id: string; title: string; workstreamId: string | null; workstream: { goalId: string } | null };

const taskRef = (task: TaskRow) => ({
  id: task.id,
  title: task.title,
  workstreamId: task.workstreamId,
  goalId: task.workstream?.goalId ?? null,
});

type Author = { authorAgent: { name: string } | null; authorUser: { name: string | null } | null };

const authorName = ({ authorAgent, authorUser }: Author) => authorAgent?.name ?? authorUser?.name ?? "Someone";

const authors = { authorAgent: { select: { name: true } }, authorUser: { select: { name: true } } } as const;

/** Everything the inbox shows one person in one project: decisions on goals they created, and news about their agents. */
async function loadFeed(userId: string, projectId: string, now: Date): Promise<NotificationFeed> {
  const since = new Date(now.getTime() - NOTIFICATION_WINDOW_DAYS * DAY_MS);
  const myGoals = { projectId, createdById: userId };
  const agentIds = (
    await prisma.agent.findMany({ where: { projectId, ownerId: userId }, select: { id: true } })
  ).map((agent) => agent.id);
  const mine = { in: agentIds };

  const [proposedIdeas, proposedTasks, biddingTasks, escalations, offers, decidedIdeas, decidedTasks, comments, points] =
    await Promise.all([
      prisma.workstream.findMany({
        where: { status: "proposed", goal: myGoals },
        include: { goal: { select: { title: true } }, proposedByAgent: { select: { name: true } }, _count: { select: { upvotes: true } } },
      }),
      prisma.task.findMany({
        where: { projectId, status: "proposed", workstream: { goal: myGoals } },
        select: { ...taskSelect, createdAt: true, workstream: { select: { goalId: true, title: true } } },
      }),
      prisma.task.findMany({
        where: { projectId, status: "bidding", offeredToAgentId: null, workstream: { goal: myGoals }, comments: { some: { type: "bid" } } },
        select: {
          ...taskSelect,
          comments: { where: { type: "bid" }, select: { createdAt: true }, orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.taskComment.findMany({
        where: { type: "escalation", createdAt: { gte: since }, task: { projectId, workstream: { goal: myGoals } } },
        include: { ...authors, task: { select: taskSelect } },
      }),
      prisma.task.findMany({
        where: { projectId, status: "bidding", offeredToAgentId: mine, offeredAt: { not: null }, offerExpiresAt: { gt: now } },
        select: { ...taskSelect, offeredAt: true, offeredToAgent: { select: { name: true } } },
      }),
      prisma.workstream.findMany({
        where: { proposedByAgentId: mine, status: { in: ["accepted", "rejected"] }, updatedAt: { gte: since }, goal: { projectId } },
        include: { proposedByAgent: { select: { name: true } } },
      }),
      prisma.task.findMany({
        where: { projectId, assignedAgentId: mine, status: { in: ["approved", "changes_requested"] }, updatedAt: { gte: since } },
        select: { ...taskSelect, status: true, revisionCount: true, updatedAt: true, assignedAgent: { select: { name: true } } },
      }),
      prisma.taskComment.findMany({
        where: {
          type: { in: ["note", "review"] },
          createdAt: { gte: since },
          task: { projectId, assignedAgentId: mine },
          // Only what other people and agents said; null authors need their own branch, since NOT IN drops them.
          AND: [
            { OR: [{ authorAgentId: null }, { authorAgentId: { notIn: agentIds } }] },
            { OR: [{ authorUserId: null }, { authorUserId: { not: userId } }] },
          ],
        },
        include: { ...authors, task: { select: { ...taskSelect, assignedAgent: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      prisma.pointsLedger.findMany({
        where: { userId, projectId, createdAt: { gte: since }, amount: { not: 0 } },
        include: { agent: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
    ]);

  return {
    proposedIdeas: proposedIdeas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      goalId: idea.goalId,
      goalTitle: idea.goal.title,
      agentName: idea.proposedByAgent?.name ?? null,
      upvotes: idea._count.upvotes,
      createdAt: idea.createdAt,
    })),
    proposedTasks: proposedTasks.map((task) => ({
      task: taskRef(task),
      workstreamTitle: task.workstream?.title ?? null,
      createdAt: task.createdAt,
    })),
    biddingTasks: biddingTasks.map((task) => ({
      task: taskRef(task),
      bidCount: task.comments.length,
      lastBidAt: task.comments[0].createdAt,
    })),
    escalations: escalations.map((comment) => ({
      id: comment.id,
      task: taskRef(comment.task),
      authorName: authorName(comment),
      body: comment.body,
      createdAt: comment.createdAt,
    })),
    offers: offers.map((task) => ({
      task: taskRef(task),
      agentName: task.offeredToAgent?.name ?? "Your agent",
      offeredAt: task.offeredAt ?? now,
    })),
    decidedIdeas: decidedIdeas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      goalId: idea.goalId,
      status: idea.status === "accepted" ? "accepted" : "rejected",
      agentName: idea.proposedByAgent?.name ?? "Your agent",
      reason: idea.rejectionReason,
      updatedAt: idea.updatedAt,
    })),
    decidedTasks: decidedTasks.map((task) => ({
      task: taskRef(task),
      status: task.status === "approved" ? "approved" : "changes_requested",
      agentName: task.assignedAgent?.name ?? "Your agent",
      revisionCount: task.revisionCount,
      updatedAt: task.updatedAt,
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      task: taskRef(comment.task),
      type: comment.type === "review" ? "review" : "note",
      isReply: comment.parentId !== null,
      authorName: authorName(comment),
      agentName: comment.task.assignedAgent?.name ?? "your agent",
      body: comment.body,
      verdict: comment.verdict,
      score: comment.score,
      createdAt: comment.createdAt,
    })),
    points: points.map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
      reason: entry.reason,
      note: entry.note,
      agentName: entry.agent?.name ?? null,
      createdAt: entry.createdAt,
    })),
  };
}

export async function getNotifications(userId: string, projectId: string, now = new Date()): Promise<NotificationList> {
  const feed = await loadFeed(userId, projectId, now);
  const unmarked = buildNotifications(feed, new Set());
  const reads = await prisma.inboxRead.findMany({
    where: { userId, itemKey: { in: unmarked.map((item) => item.id) } },
    select: { itemKey: true },
  });
  const readKeys = new Set(reads.map((read) => read.itemKey));
  const items = unmarked.map((item) => ({ ...item, read: readKeys.has(item.id) }));
  return { items, unreadCount: items.filter((item) => !item.read).length };
}

/** Marks the given items read, or everything currently in the inbox when `ids` is left out. */
export async function markNotificationsRead(userId: string, projectId: string, ids?: string[]) {
  const keys = ids ?? (await getNotifications(userId, projectId)).items.filter((item) => !item.read).map((item) => item.id);
  if (keys.length === 0) return;
  await prisma.inboxRead.createMany({
    data: keys.map((itemKey) => ({ userId, itemKey })),
    skipDuplicates: true,
  });
}
