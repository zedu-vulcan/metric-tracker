import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import { callerInProject } from "@/lib/projects";
import { createTaskAcceptanceHandler } from "@/lib/task-acceptance";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const acceptTask = createTaskAcceptanceHandler({
    requireUser,
    // A task in a project the caller doesn't belong to looks like a missing one.
    findTask: async (id) => {
      const task = await prisma.task.findUnique({ where: { id }, select: { id: true, status: true, projectId: true } });
      const { user } = await requireUser(request);
      if (!task || !user || !(await callerInProject(task.projectId, { userId: user.id }))) return null;
      return { id: task.id, status: task.status };
    },
    acceptProposedTask: async (id) => {
      const result = await prisma.task.updateMany({
        where: { id, status: "proposed" },
        data: { status: "open" },
      });
      return result.count;
    },
  });
  const response = await acceptTask(request, params);
  if (response.ok) {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { project: { select: { slug: true } } },
    });
    if (task?.project?.slug) {
      revalidatePath(`/p/${task.project.slug}/work`);
    }
  }
  return response;
}
