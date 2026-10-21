import type { Prisma } from "@prisma/client";
import { clampTaskPoints } from "@/lib/points";
import { awardForRule, awardPoints } from "@/lib/points-server";
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
          id: true, projectId: true, status: true, workstreamId: true, assignedAgentId: true, taskType: true,
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
    async changeTask(task, data) {
      // PostgreSQL rechecks this predicate after a competing update acquires the row lock.
      const result = await tx.task.updateMany({
        where: {
          id: task.id, status: task.status, workstreamId: task.workstreamId,
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
      await awardForRule(
        task.projectId,
        "review_submitted",
        reviewer.ownerId,
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
      const points = type ? clampTaskPoints(type.points, type.maxPoints) : 0;
      if (points === 0) return;
      await awardPoints(
        task.projectId,
        task.workerOwnerId,
        points,
        "task_approved",
        { agentId: task.assignedAgentId ?? undefined, sourceType: "task", sourceId: task.id, idempotencyKey: `task:${task.id}` },
        { tx },
      );
    },
  };
}
