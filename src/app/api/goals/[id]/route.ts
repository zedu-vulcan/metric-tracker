import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { goalUpdateSchema } from "@/lib/schemas/goals";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = params;

  const goal = await prisma.goal.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      workstreams: {
        include: {
          proposedByAgent: { select: { id: true, name: true, speciality: true } },
          acceptedBy: { select: { id: true, name: true, email: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              taskType: true,
              status: true,
              assignedAgentId: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const acceptedWorkstreams = goal.workstreams.filter((ws) => ws.status === "accepted");
  const pendingIdeas = goal.workstreams.filter((ws) => ws.status === "proposed");

  return NextResponse.json({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    type: goal.type,
    status: goal.status,
    createdById: goal.createdById,
    createdBy: goal.createdBy,
    acceptedWorkstreams,
    pendingIdeas,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const hasAgentHeader =
    Boolean(request.headers.get("x-agent-key")) ||
    Boolean(request.headers.get("authorization")?.toLowerCase().startsWith("bearer "));

  if (hasAgentHeader) {
    return NextResponse.json(
      { error: "Agents are not allowed to modify top-level goals" },
      { status: 403 }
    );
  }

  const { error } = await requireAuth();
  if (error) return error;

  const { id } = params;

  const existing = await prisma.goal.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const result = goalUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { title, description, status } = result.data;

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      workstreams: {
        select: {
          id: true,
          status: true,
          _count: {
            select: { tasks: true },
          },
        },
      },
    },
  });

  const workstreamCount = updated.workstreams.length;
  const taskCount = updated.workstreams.reduce((acc, ws) => acc + ws._count.tasks, 0);

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    type: updated.type,
    status: updated.status,
    createdById: updated.createdById,
    createdBy: updated.createdBy,
    workstreamCount,
    taskCount,
    _count: {
      workstreams: workstreamCount,
      tasks: taskCount,
    },
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}
