import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import { createTaskApprovalHandler } from "@/lib/task-approval";
import { isReviewCoordinator } from "@/lib/task-comments";

export const dynamic = "force-dynamic";

const approveTask = createTaskApprovalHandler({
  requireUser,
  findTask: (id) =>
    prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        // The goal's creator counts as the project owner for approval rights.
        workstream: { select: { goal: { select: { createdById: true } } } },
      },
    }).then((task) =>
      task
        ? {
            id: task.id,
            status: task.status,
            ownerIds: task.workstream ? [task.workstream.goal.createdById] : [],
          }
        : null
    ),
  // Task 4.4: a configured Review Coordinator, or the human who created the parent goal.
  canApprove: (userId, task) =>
    isReviewCoordinator(userId) || (task.ownerIds ?? []).includes(userId),
  approveTaskWithComment: async ({ taskId, userId, title, body, tag }) => {
    const completedAt = new Date();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.task.updateMany({
        where: {
          id: taskId,
          status: { in: ["submitted", "in_review"] },
        },
        data: {
          status: "approved",
          done: true,
          completedAt,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      const comment = await tx.taskComment.create({
        data: {
          taskId,
          type: "approval",
          title,
          body,
          tag,
          authorUserId: userId,
        },
        include: {
          authorAgent: { select: { id: true, name: true, speciality: true } },
          authorUser: { select: { id: true, name: true, email: true } },
        },
      });

      return {
        completedAt,
        comment: {
          ...comment,
          type: "approval" as const,
        },
      };
    });
  },
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return approveTask(request, params);
}
