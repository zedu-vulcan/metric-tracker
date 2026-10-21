import { NextResponse } from "next/server";
import type { Prisma, TaskType } from "@prisma/client";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskCreateSchema, taskTypeValues } from "@/lib/schemas/tasks";
import { serializeTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as { id?: string }).id;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const assignedToMe = searchParams.get("assignedToMe");

  const where: Prisma.TaskWhereInput = {};

  if (status === "open") {
    where.done = false;
  } else if (status === "completed") {
    where.done = true;
  }

  if (type && (taskTypeValues as readonly string[]).includes(type)) {
    where.type = type as TaskType;
  }

  if (userId) {
    if (assignedToMe === "true") {
      where.ownerId = userId;
    } else if (assignedToMe === "false") {
      where.OR = [{ ownerId: { not: userId } }, { ownerId: null }];
    }
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  return NextResponse.json(tasks.map(serializeTask));
}

export async function POST(request: Request) {
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

  const result = taskCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = result.data;
  // If assignToMe is true, automatically assign to current user. Otherwise use ownerId if provided, or null.
  const ownerId = data.assignToMe ? userId : data.ownerId ?? null;

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      dueAt: new Date(data.dueAt),
      ownerId,
      userId,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(serializeTask(task), { status: 201 });
}
