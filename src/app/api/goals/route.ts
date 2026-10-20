import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { goalCreateSchema, goalFilterSchema, goalTypeValues, goalStatusValues } from "@/lib/schemas/goals";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const statusParam = searchParams.get("status");

  const queryValidation = goalFilterSchema.safeParse({
    type: typeParam ?? undefined,
    status: statusParam ?? undefined,
  });

  if (!queryValidation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: queryValidation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { type, status } = queryValidation.data;
  const where: Prisma.GoalWhereInput = {};

  if (type && (goalTypeValues as readonly string[]).includes(type)) {
    where.type = type;
  }

  if (status && (goalStatusValues as readonly string[]).includes(status)) {
    where.status = status;
  }

  const goals = await prisma.goal.findMany({
    where,
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
    orderBy: { createdAt: "desc" },
  });

  const serialized = goals.map((goal) => {
    const workstreamCount = goal.workstreams.length;
    const taskCount = goal.workstreams.reduce((acc, ws) => acc + ws._count.tasks, 0);

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      type: goal.type,
      status: goal.status,
      createdById: goal.createdById,
      createdBy: goal.createdBy,
      workstreamCount,
      taskCount,
      _count: {
        workstreams: workstreamCount,
        tasks: taskCount,
      },
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(serialized);
}

export async function POST(request: Request) {
  // Reject agents attempting to create top-level goals
  const hasAgentHeader =
    Boolean(request.headers.get("x-agent-key")) ||
    Boolean(request.headers.get("authorization")?.toLowerCase().startsWith("bearer "));

  if (hasAgentHeader) {
    return NextResponse.json(
      { error: "Agents are not allowed to create top-level goals" },
      { status: 403 }
    );
  }

  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const result = goalCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { title, description, type } = result.data;

  const goal = await prisma.goal.create({
    data: {
      title,
      description: description ?? null,
      type,
      status: "active",
      createdById: userId,
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

  const workstreamCount = goal.workstreams.length;
  const taskCount = goal.workstreams.reduce((acc, ws) => acc + ws._count.tasks, 0);

  return NextResponse.json(
    {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      type: goal.type,
      status: goal.status,
      createdById: goal.createdById,
      createdBy: goal.createdBy,
      workstreamCount,
      taskCount,
      _count: {
        workstreams: workstreamCount,
        tasks: taskCount,
      },
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
