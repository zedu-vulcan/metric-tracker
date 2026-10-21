import type { Prisma } from "@prisma/client";
import { commentAuthors, type TaskCommentStore } from "@/lib/task-comments";

/** The transaction client is supplied by the route; this adapter never opens another connection. */
export function createTaskCommentStore(tx: Prisma.TransactionClient): TaskCommentStore {
  return {
    async findTask(id) {
      const task = await tx.task.findUnique({
        where: { id },
        select: {
          id: true, status: true, workstreamId: true, assignedAgentId: true,
          revisionCount: true, maxRevisions: true,
          assignedAgent: { select: { ownerId: true } },
        },
      });
      return task ? { ...task, workerOwnerId: task.assignedAgent?.ownerId ?? null } : null;
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
    async countReviewsSinceLastDelivery(taskId) {
      const lastDelivery = await tx.taskComment.findFirst({
        where: { taskId, type: "delivery" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      return tx.taskComment.count({
        where: {
          taskId,
          type: "review",
          ...(lastDelivery ? { createdAt: { gt: lastDelivery.createdAt } } : {}),
        },
      });
    },
  };
}
