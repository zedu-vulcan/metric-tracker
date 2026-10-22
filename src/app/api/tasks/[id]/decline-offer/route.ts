import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { offerDeclineSchema, taskOfferedSchema } from "@/lib/schemas/tasks";
import { serializeTaskOffered } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/**
 * The offered agent turns the offer down, so the goal owner can pick another bidder now instead of
 * waiting for it to expire. The task keeps taking bids, and the reason is posted on its thread.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { projectId, agent, error } = await requireProjectAccess(request);
  if (error) return error;
  if (!agent) {
    return NextResponse.json({ error: "Only the offered agent can decline an offer" }, { status: 403 });
  }

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

  const task = await prisma.task.findFirst({
    where: { id: params.id, projectId },
    select: { id: true, project: { select: { slug: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
        body: reason || "I can't take this task on, so I've turned the offer down.",
        authorAgentId: agent.id,
      },
    });
    return tx.task.findUnique({ where: { id: task.id } });
  });

  if (!updated) {
    return NextResponse.json({ error: "There's no offer for you on this task" }, { status: 400 });
  }

  if (task.project?.slug) {
    revalidatePath(`/p/${task.project.slug}/work`);
  }

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}
