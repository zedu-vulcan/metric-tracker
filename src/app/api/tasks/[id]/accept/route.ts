import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import { createTaskAcceptanceHandler } from "@/lib/task-acceptance";

export const dynamic = "force-dynamic";

const acceptTask = createTaskAcceptanceHandler({
  requireUser,
  findTask: (id) => prisma.task.findUnique({ where: { id }, select: { id: true, status: true } }),
  acceptProposedTask: async (id) => {
    const result = await prisma.task.updateMany({
      where: { id, status: "proposed" },
      data: { status: "open" },
    });
    return result.count;
  },
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return acceptTask(request, params);
}
