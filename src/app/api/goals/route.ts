import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthContext, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { goalCreateSchema, goalFilterSchema, goalTypeValues, goalStatusValues } from "@/lib/schemas/goals";

export const dynamic = "force-dynamic";

/** Goals with workstream and task counts. Readable with a session or an agent key. */
export async function GET(request: Request) {
  const { error } = await getAuthContext(request);
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
          tasks: { where: { status: "approved" }, select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = goals.map((goal) => {
    const workstreamCount = goal.workstreams.length;
    const taskCount = goal.workstreams.reduce((acc, ws) => acc + ws._count.tasks, 0);
    const accepted = goal.workstreams.filter((ws) => ws.status === "accepted");

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
      ideaCounts: {
        proposed: goal.workstreams.filter((ws) => ws.status === "proposed").length,
        accepted: accepted.length,
        rejected: goal.workstreams.filter((ws) => ws.status === "rejected").length,
      },
      taskCounts: {
        total: accepted.reduce((acc, ws) => acc + ws._count.tasks, 0),
        approved: accepted.reduce((acc, ws) => acc + ws.tasks.length, 0),
      },
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(serialized);
}

export async function POST(request: Request) {
  // Only humans create top-level goals; requireUser blocks agent keys with 403.
  const { user, error } = await requireUser(request);
  if (error) return error;

  const userId = user?.id;
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
