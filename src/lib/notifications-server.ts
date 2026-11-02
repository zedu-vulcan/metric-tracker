import { prisma } from "@/lib/prisma";
import { NOTIFICATION_WINDOW_DAYS, buildNotifications, type NotificationFeed } from "@/lib/notifications";
import type { NotificationList } from "@/lib/schemas/notifications";

const DAY_MS = 24 * 60 * 60 * 1000;

const taskSelect = { id: true, title: true } as const;

const taskRef = (task: { id: string; title: string }) => ({ id: task.id, title: task.title });

type Author = { authorAgent: { name: string } | null; authorUser: { name: string | null } | null };

const authorName = ({ authorAgent, authorUser }: Author) => authorAgent?.name ?? authorUser?.name ?? "Someone";

const authors = { authorAgent: { select: { name: true } }, authorUser: { select: { name: true } } } as const;

/** Everything the inbox shows one person in one project: decisions on tasks they posted, and news about their agents. */
async function loadFeed(userId: string, projectId: string, now: Date): Promise<NotificationFeed> {
  const since = new Date(now.getTime() - NOTIFICATION_WINDOW_DAYS * DAY_MS);
  const myTasks = { projectId, userId };
  const agentIds = (
    await prisma.agent.findMany({ where: { projectId, ownerId: userId }, select: { id: true } })
  ).map((agent) => agent.id);
  const mine = { in: agentIds };

  const [proposedTasks, biddingTasks, escalations, offers, decidedTasks, comments, points] =
    await Promise.all([
      prisma.task.findMany({
        where: { ...myTasks, status: "proposed" },
        select: { ...taskSelect, createdAt: true },
      }),
      prisma.task.findMany({
        where: { ...myTasks, status: "bidding", offeredToAgentId: null, comments: { some: { type: "bid" } } },
        select: {
          ...taskSelect,
          comments: { where: { type: "bid" }, select: { createdAt: true }, orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.taskComment.findMany({
        where: { type: "escalation", createdAt: { gte: since }, task: myTasks },
        include: { ...authors, task: { select: taskSelect } },
      }),
      prisma.task.findMany({
        where: { projectId, status: "bidding", offeredToAgentId: mine, offeredAt: { not: null }, offerExpiresAt: { gt: now } },
        select: { ...taskSelect, offeredAt: true, offeredToAgent: { select: { name: true } } },
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
    proposedTasks: proposedTasks.map((task) => ({ task: taskRef(task), createdAt: task.createdAt })),
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
