import type { Prisma } from "@prisma/client";
import { getPointSettings } from "@/lib/point-settings";
import { clampTaskPoints, shareOfTaskPoints } from "@/lib/points";
import { awardPoints } from "@/lib/points-server";
import { commentAuthors, type TaskCommentStore } from "@/lib/task-comments";

/** The transaction client is supplied by the route; this adapter never opens another connection. */
export function createTaskCommentStore(tx: Prisma.TransactionClient): TaskCommentStore {
  return {
    async findTask(id) {
      // Comments on one task are written one at a time, so two reviews can't both miss the deciding vote.
      await tx.$queryRaw`SELECT id FROM "Task" WHERE id = ${id} FOR UPDATE`;
      const task = await tx.task.findUnique({
        where: { id },
        select: {
          id: true, projectId: true, status: true, userId: true, assignedAgentId: true, taskType: true, points: true,
          revisionCount: true, maxRevisions: true,
          assignedAgent: { select: { ownerId: true } },
        },
      });
      if (!task) return null;
      const { assignedAgent, ...rest } = task;
      return { ...rest, workerOwnerId: assignedAgent?.ownerId ?? null };
    },
    async userInProject(userId, projectId) {
      const membership = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { id: true },
      });
      return membership !== null;
    },
    findComment: (id) => tx.taskComment.findUnique({ where: { id }, select: { taskId: true, parentId: true } }),
    async changeTask(task, data) {
      // PostgreSQL rechecks this predicate after a competing update acquires the row lock.
      const result = await tx.task.updateMany({
        where: {
          id: task.id, status: task.status,
          assignedAgentId: task.assignedAgentId, revisionCount: task.revisionCount,
          maxRevisions: task.maxRevisions,
        },
        data,
      });
      return result.count === 1;
    },
    createComment: (data) => tx.taskComment.create({ data, include: commentAuthors }),
    async roundReviews(taskId) {
      const lastDelivery = await tx.taskComment.findFirst({
        where: { taskId, type: "delivery" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return tx.taskComment.findMany({
        where: {
          taskId,
          type: "review",
          ...(lastDelivery ? { createdAt: { gt: lastDelivery.createdAt } } : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { authorAgentId: true, verdict: true },
      });
    },
    async payReview(task, commentId, reviewer) {
      // This review is already saved, so it's part of the count.
      const [reviews, settings] = await Promise.all([
        tx.taskComment.count({ where: { taskId: task.id, type: "review" } }),
        getPointSettings(task.projectId, tx),
      ]);
      if (reviews > settings.paidReviewsPerTask || settings.reviewPoints === 0) return;
      await awardPoints(
        task.projectId,
        reviewer.ownerId,
        settings.reviewPoints,
        "review_submitted",
        { agentId: reviewer.id, sourceType: "comment", sourceId: commentId, idempotencyKey: `review:${commentId}` },
        { tx, workerOwnerId: task.workerOwnerId ?? undefined },
      );
    },
    async payTask(task) {
      if (!task.workerOwnerId || !task.taskType) return;
      const type = await tx.taskTypeDef.findUnique({
        where: { projectId_slug: { projectId: task.projectId, slug: task.taskType } },
        select: { points: true, maxPoints: true },
      });
      const points = type ? clampTaskPoints(task.points ?? type.points, type.maxPoints) : 0;
      if (points === 0) return;
      await awardPoints(
        task.projectId,
        task.workerOwnerId,
        points,
        "task_approved",
        { agentId: task.assignedAgentId ?? undefined, sourceType: "task", sourceId: task.id, idempotencyKey: `task:${task.id}` },
        { tx },
      );

      // A share for whoever posted the task, on top of the worker's points.
      if (!task.userId || task.userId === task.workerOwnerId) return;
      const { creatorSharePct } = await getPointSettings(task.projectId, tx);
      const share = shareOfTaskPoints(points, creatorSharePct);
      if (share === 0) return;
      await awardPoints(
        task.projectId,
        task.userId,
        share,
        "goal_task_approved",
        { sourceType: "task", sourceId: task.id, idempotencyKey: `goal-share:${task.id}` },
        { tx },
      );
    },
  };
}
