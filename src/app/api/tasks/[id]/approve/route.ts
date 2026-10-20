import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import { createTaskApprovalHandler } from "@/lib/task-approval";

export const dynamic = "force-dynamic";

const approveTask = createTaskApprovalHandler({
  requireUser,
  findTask: (id) =>
    prisma.task.findUnique({
      where: { id },
      select: { id: true, status: true },
    }),
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

