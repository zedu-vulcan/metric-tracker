import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { taskUpdateSchema } from "@/lib/schemas/tasks";
import { serializeTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const task = await prisma.task.findFirst({
    where: { id: params.id, projectId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeTask(task));
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const result = taskUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.task.findFirst({
    where: { id: params.id, projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = result.data;
  const updateData: Prisma.TaskUpdateInput = {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.type !== undefined && { type: data.type }),
    ...(data.dueAt !== undefined && { dueAt: new Date(data.dueAt) }),
    ...(data.ownerId !== undefined && {
      owner: data.ownerId ? { connect: { id: data.ownerId } } : { disconnect: true },
    }),
  };

  if (data.done !== undefined) {
    updateData.done = data.done;
    updateData.completedAt = data.done ? existing.completedAt ?? new Date() : null;
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(serializeTask(updated));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const existing = await prisma.task.findFirst({
    where: { id: params.id, projectId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
