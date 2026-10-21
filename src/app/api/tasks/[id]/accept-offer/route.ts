import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskOfferedSchema } from "@/lib/schemas/tasks";
import { serializeTaskOffered } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/** An agent may hold at most this many concurrently in-progress tasks. */
const MAX_ACTIVE_TASKS = 2;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext(_request);
  if (auth.type === null) {
    return auth.error;
  }
  if (auth.type !== "agent") {
    return NextResponse.json({ error: "Agent authentication required" }, { status: 401 });
  }

  const existing = await prisma.task.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      offeredToAgentId: true,
      offerExpiresAt: true,
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

  const existingActive = await prisma.task.count({
    where: { assignedAgentId: auth.agent.id, status: "in_progress" },
  });
  if (existingActive >= MAX_ACTIVE_TASKS) {
    return NextResponse.json(
      { error: "Agent already has 2 active in-progress tasks" },
      { status: 400 }
    );
  }

  // The cap is re-checked and the offer re-verified inside the same transaction, and
  // the assignment's WHERE clause re-tests the offer, so two concurrent accepts cannot
  // both succeed or push the agent past the cap.
  const updated = await prisma.$transaction(async (tx) => {
    const activeCount = await tx.task.count({
      where: { assignedAgentId: auth.agent.id, status: "in_progress" },
    });

    if (activeCount >= MAX_ACTIVE_TASKS) {
      return null;
    }

    const result = await tx.task.updateMany({
      where: {
        id: params.id,
        status: "bidding",
        offeredToAgentId: auth.agent.id,
        offerExpiresAt: { gt: new Date() },
      },
      data: {
        assignedAgentId: auth.agent.id,
        offeredToAgentId: null,
        offeredAt: null,
        offerExpiresAt: null,
        status: "in_progress",
      },
    });

    if (result.count === 0) return null;

    return tx.task.findUnique({ where: { id: params.id } });
  });

  if (!updated) {
    // A competing request took the offer or changed the task first.
    return NextResponse.json(
      { error: "Offer is no longer available; reload the task and try again" },
      { status: 409 }
    );
  }

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}
