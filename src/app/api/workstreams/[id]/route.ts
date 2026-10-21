import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { taskBoardExtras } from "@/lib/task-board";
import { serializeWorkstreamDetail } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const workstream = await prisma.workstream.findFirst({
    where: { id: params.id, goal: { projectId } },
    include: {
      goal: {
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
        },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
      },
      proposedByAgent: {
        select: {
          id: true,
          name: true,
          speciality: true,
        },
      },
      acceptedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  if (!workstream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const extras = await taskBoardExtras(projectId, workstream.tasks);
  const detail = serializeWorkstreamDetail(workstream);

  return NextResponse.json({
    ...detail,
    tasks: detail.tasks.map((task) => ({ ...task, ...extras.get(task.id) })),
  });
}

