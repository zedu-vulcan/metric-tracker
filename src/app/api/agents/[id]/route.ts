import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { serializeAgent } from "@/lib/agents";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
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
