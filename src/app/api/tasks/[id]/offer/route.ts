import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { offerCreateSchema, taskOfferedSchema } from "@/lib/schemas/tasks";
import { serializeTaskOffered } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const result = offerCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.task.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status !== "open" && existing.status !== "bidding") {
    return NextResponse.json({ error: "Task is not open for offers" }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({
    where: { id: result.data.agentId },
    select: { id: true },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const now = new Date();
  const offerExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      offeredToAgentId: agent.id,
      offeredAt: now,
      offerExpiresAt,
      status: "bidding",
    },
  });

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}
