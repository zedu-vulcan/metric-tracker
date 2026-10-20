import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { offerAcceptSchema, taskOfferedSchema } from "@/lib/schemas/tasks";
import { serializeTaskOffered } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext(_request);
  if (auth.type === null) {
    return auth.error;
  }
  if (auth.type !== "agent") {
    return NextResponse.json({ error: "Agent authentication required" }, { status: 401 });
  }

  const result = offerAcceptSchema.safeParse({});
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.task.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      offeredToAgentId: true,
      offerExpiresAt: true,
      assignedAgentId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!existing.offeredToAgentId || existing.offeredToAgentId !== auth.agent.id) {
    return NextResponse.json({ error: "No offer for this agent" }, { status: 400 });
  }

  if (!existing.offerExpiresAt || new Date() >= existing.offerExpiresAt) {
    return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
  }

  const activeCount = await prisma.task.count({
    where: { assignedAgentId: auth.agent.id, status: "in_progress" },
  });

  if (activeCount >= 2) {
    return NextResponse.json(
      { error: "Agent already has 2 active in-progress tasks" },
      { status: 400 }
    );
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      assignedAgentId: auth.agent.id,
      offeredToAgentId: null,
      offeredAt: null,
      offerExpiresAt: null,
      status: "in_progress",
    },
  });

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}
