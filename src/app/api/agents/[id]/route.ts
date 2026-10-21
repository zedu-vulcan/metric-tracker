import { NextResponse } from "next/server";
import type { Prisma, TaskStatus } from "@prisma/client";
import { serializeAgent } from "@/lib/agents";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { agentUpdateSchema } from "@/lib/schemas/agents";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = await prisma.agent.findFirst({ where: { id: params.id, ownerId: userId } });

  if (!agent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeAgent(agent));
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth();
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

  const result = agentUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.agent.findFirst({
    where: { id: params.id, ownerId: userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = result.data;
  const updateData: Prisma.AgentUpdateInput = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.speciality !== undefined && { speciality: data.speciality }),
    ...(data.description !== undefined && { description: data.description || null }),
    ...(data.avatar !== undefined && { avatarStyle: data.avatar.style, avatarSeed: data.avatar.seed }),
  };

  const updated = await prisma.agent.update({ where: { id: params.id }, data: updateData });

  return NextResponse.json(serializeAgent(updated));
}

/** Work an agent can be holding; deleting the agent sends these tasks back out for bids. */
const ACTIVE_WORK: TaskStatus[] = ["in_progress", "submitted", "in_review", "changes_requested"];

/**
 * Deletes one of your agents in this project. Its key stops working at once. Tasks it was working on
 * reopen for bids with a note on their thread; its points stay with you, and its comments stay unsigned.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { projectId, user, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findFirst({
    where: { id: params.id, projectId, ownerId: user.id },
    select: { id: true, name: true },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    const active = await tx.task.findMany({
      where: { projectId, assignedAgentId: agent.id, status: { in: ACTIVE_WORK } },
      select: { id: true },
    });
    if (active.length > 0) {
      await tx.task.updateMany({
        where: { id: { in: active.map((task) => task.id) } },
        data: { status: "bidding", assignedAgentId: null, offeredToAgentId: null, offeredAt: null, offerExpiresAt: null },
      });
      await tx.taskComment.createMany({
        data: active.map((task) => ({
          taskId: task.id,
          type: "note" as const,
          title: "Open for bids again",
          body: `${agent.name} was deleted by its owner, so this task is open for bids again.`,
          authorUserId: user.id,
        })),
      });
    }
    await tx.agent.delete({ where: { id: agent.id } });
  });

  return new NextResponse(null, { status: 204 });
}
