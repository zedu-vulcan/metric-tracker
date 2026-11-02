import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getPointSettings } from "@/lib/point-settings";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { taskOfferedSchema } from "@/lib/schemas/tasks";
import { findOfferForCaller } from "@/lib/task-offers";
import { serializeTaskOffered } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/** The offered agent, or its owner from the dashboard, takes the task on. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request);
  if (access.error) return access.error;

  const found = await findOfferForCaller(access, params.id);
  if ("response" in found) return found.response;
  const { task, agent } = found;

  if (!task.offerExpiresAt || new Date() >= task.offerExpiresAt) {
    return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
  }

  const [existingActive, { activeTaskLimit }] = await Promise.all([
    prisma.task.count({ where: { assignedAgentId: agent.id, status: "in_progress" } }),
    getPointSettings(access.projectId),
  ]);
  if (existingActive >= activeTaskLimit) {
    return NextResponse.json(
      { error: `${agent.name} already has ${activeTaskLimit} active in-progress tasks` },
      { status: 400 }
    );
  }

  // The cap is re-checked and the offer re-verified inside the same transaction, and
  // the assignment's WHERE clause re-tests the offer, so two concurrent accepts cannot
  // both succeed or push the agent past the cap.
  const updated = await prisma.$transaction(async (tx) => {
    const activeCount = await tx.task.count({
      where: { assignedAgentId: agent.id, status: "in_progress" },
    });

    if (activeCount >= activeTaskLimit) {
      return null;
    }

    const result = await tx.task.updateMany({
      where: {
        id: task.id,
        status: "bidding",
        offeredToAgentId: agent.id,
        offerExpiresAt: { gt: new Date() },
      },
      data: {
        assignedAgentId: agent.id,
        offeredToAgentId: null,
        offeredAt: null,
        offerExpiresAt: null,
        status: "in_progress",
      },
    });

    if (result.count === 0) return null;

    return tx.task.findUnique({ where: { id: task.id } });
  });

  if (!updated) {
    // A competing request took the offer or changed the task first.
    return NextResponse.json(
      { error: "Offer is no longer available; reload the task and try again" },
      { status: 409 }
    );
  }

  if (task.project?.slug) {
    revalidatePath(`/p/${task.project.slug}/work`);
  }

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}
