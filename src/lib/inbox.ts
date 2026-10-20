import { CommentType, TaskStatus } from "@prisma/client";
import type { Agent, Goal, Task, TaskComment, Workstream } from "@prisma/client";
import { prisma } from "./prisma";

export const INBOX_COMMENT_LIMIT = 50;
export const INBOX_COMMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

type InboxTask = {
  id: string;
  title: string;
  status: TaskStatus;
  taskType: string | null;
  workstream: {
    id: string;
    title: string;
    goal: { id: string; title: string };
  } | null;
};

type InboxComment = {
  id: string;
  type: CommentType;
  tag: string | null;
  title: string | null;
  body: string;
  attachment: string | null;
  score: number | null;
  createdAt: string;
  authorAgent: { id: string; name: string } | null;
  authorUser: { id: string; name: string | null } | null;
};

type TaskWithWorkstream = Task & {
  workstream: (Workstream & { goal: Goal }) | null;
};

type CommentWithAuthors = TaskComment & {
  authorAgent: { id: string; name: string } | null;
  authorUser: { id: string; name: string | null } | null;
};

export function secondsUntil(date: Date, now: Date): number {
  return Math.max(0, Math.floor((date.getTime() - now.getTime()) / 1000));
}

function serializeTask(task: TaskWithWorkstream): InboxTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    taskType: task.taskType,
    workstream: task.workstream
      ? {
          id: task.workstream.id,
          title: task.workstream.title,
          goal: {
            id: task.workstream.goal.id,
            title: task.workstream.goal.title,
          },
        }
      : null,
  };
}

function serializeComment(comment: CommentWithAuthors): InboxComment {
  return {
    id: comment.id,
    type: comment.type,
    tag: comment.tag,
    title: comment.title,
    body: comment.body,
    attachment: comment.attachment,
    score: comment.score,
    createdAt: comment.createdAt.toISOString(),
    authorAgent: comment.authorAgent,
    authorUser: comment.authorUser,
  };
}

export async function expireOffers(now = new Date()): Promise<number> {
  const result = await prisma.task.updateMany({
    where: {
      offeredToAgentId: { not: null },
      offerExpiresAt: { lt: now },
      status: { not: TaskStatus.in_progress },
    },
    data: {
      offeredToAgentId: null,
      offeredAt: null,
      offerExpiresAt: null,
      status: TaskStatus.bidding,
    },
  });

  return result.count;
}

export async function getAgentInbox(
  agent: Pick<Agent, "id" | "name" | "speciality">,
  now = new Date()
) {
  const expiredOffers = await expireOffers(now);
  const commentSince = new Date(now.getTime() - INBOX_COMMENT_WINDOW_MS);

  const [offers, revisions, comments] = await Promise.all([
    prisma.task.findMany({
      where: {
        offeredToAgentId: agent.id,
        offerExpiresAt: { gt: now },
        status: { not: TaskStatus.in_progress },
      },
      include: { workstream: { include: { goal: true } } },
      orderBy: { offerExpiresAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        assignedAgentId: agent.id,
        status: TaskStatus.changes_requested,
      },
      include: {
        workstream: { include: { goal: true } },
        comments: {
          where: { type: CommentType.revision_request },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            authorAgent: { select: { id: true, name: true } },
            authorUser: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.taskComment.findMany({
      where: {
        task: { assignedAgentId: agent.id },
        createdAt: { gte: commentSince },
        type: { not: CommentType.revision_request },
        OR: [{ authorAgentId: null }, { authorAgentId: { not: agent.id } }],
      },
      include: {
        authorAgent: { select: { id: true, name: true } },
        authorUser: { select: { id: true, name: true } },
        task: { include: { workstream: { include: { goal: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: INBOX_COMMENT_LIMIT,
    }),
  ]);

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      speciality: agent.speciality,
    },
    expiredOffers,
    offers: offers.map((task) => ({
      task: serializeTask(task),
      offerExpiresAt: task.offerExpiresAt?.toISOString() ?? null,
      expiresInSeconds: task.offerExpiresAt ? secondsUntil(task.offerExpiresAt, now) : 0,
    })),
    revisions: revisions.map((task) => ({
      task: serializeTask(task),
      revisionCount: task.revisionCount,
      latestRevisionRequest: task.comments[0] ? serializeComment(task.comments[0]) : null,
    })),
    comments: comments.map((comment) => ({
      task: serializeTask(comment.task),
      comment: serializeComment(comment),
    })),
  };
}
