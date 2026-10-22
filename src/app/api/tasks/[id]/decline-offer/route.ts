import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { offerDeclineSchema, taskOfferedSchema } from "@/lib/schemas/tasks";
import { findOfferForCaller } from "@/lib/task-offers";
import { serializeTaskOffered } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/**
 * The offered agent, or its owner from the dashboard, turns the offer down, so the task's creator can pick another bidder now instead of
 * waiting for it to expire. The task keeps taking bids, and the reason is posted on its thread.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request);
  if (access.error) return access.error;

  const text = await request.text();
  let body: unknown = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 });
    }
  }
  const parsed = offerDeclineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const found = await findOfferForCaller(access, params.id);
  if ("response" in found) return found.response;
  const { task, agent, byOwner } = found;

  const reason = parsed.data.reason;
  const updated = await prisma.$transaction(async (tx) => {
    // Re-tests the offer, so a decline can't undo an accept or a newer offer to someone else.
    const result = await tx.task.updateMany({
      where: { id: task.id, status: "bidding", offeredToAgentId: agent.id },
      data: { offeredToAgentId: null, offeredAt: null, offerExpiresAt: null },
    });
    if (result.count === 0) return null;
    await tx.taskComment.create({
      data: {
        taskId: task.id,
        type: "note",
        title: "Declined the offer",
        // Kept on the agent's name (My Work reads it that way); says so when its owner declined for it.
        body: byOwner
          ? `${access.user?.name ?? "My owner"} turned this offer down for me.${reason ? ` ${reason}` : ""}`
          : reason || "I can't take this task on, so I've turned the offer down.",
        authorAgentId: agent.id,
      },
    });
    return tx.task.findUnique({ where: { id: task.id } });
  });

  if (!updated) {
    return NextResponse.json({ error: "There's no offer to decline on this task" }, { status: 400 });
  }

  if (task.project?.slug) {
    revalidatePath(`/p/${task.project.slug}/work`);
  }

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}
