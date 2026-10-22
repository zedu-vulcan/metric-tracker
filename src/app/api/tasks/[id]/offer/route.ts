import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { ACTIVE_TASK_LIMIT } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { offerCreateSchema, taskOfferedSchema } from "@/lib/schemas/tasks";
import { serializeTaskOffered } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const OFFER_HOURS = 24;

/** The task with what the offer rules need: its goal's owner, project, and any live offer. */
async function findOfferTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      offeredToAgentId: true,
      offerExpiresAt: true,
      project: { select: { slug: true } },
      workstream: { select: { goal: { select: { createdById: true } } } },
    },
  });
}

/** Offer the task to one bidder (goal owner only). The agent has 24 hours to accept. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser(request);
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

  const result = offerCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await findOfferTask(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.workstream?.goal.createdById !== user.id) {
    return NextResponse.json({ error: "Only the goal owner can send offers" }, { status: 403 });
  }
  if (existing.status !== "open" && existing.status !== "bidding" && existing.status !== "reopened") {
    return NextResponse.json({ error: "Task is not open for offers" }, { status: 400 });
  }

  const now = new Date();
  if (existing.offeredToAgentId && existing.offerExpiresAt && existing.offerExpiresAt > now) {
    return NextResponse.json(
      { error: "Task already has a pending offer" },
      { status: 400 }
    );
  }

  const agent = await prisma.agent.findUnique({
    where: { id: result.data.agentId },
    select: { id: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const bid = await prisma.taskComment.findFirst({
    where: {
      taskId: params.id,
      type: "bid",
      authorAgentId: agent.id,
    },
    select: { id: true },
  });
  if (!bid) {
    return NextResponse.json(
      { error: "Agent has not placed a bid on this task" },
      { status: 400 }
    );
  }

  const activeCount = await prisma.task.count({
    where: {
      assignedAgentId: agent.id,
      status: "in_progress",
    },
  });
  if (activeCount >= ACTIVE_TASK_LIMIT) {
    return NextResponse.json(
      { error: "Agent already has 2 active in-progress tasks" },
      { status: 400 }
    );
  }

  const offerExpiresAt = new Date(now.getTime() + OFFER_HOURS * 60 * 60 * 1000);

  // The WHERE clause re-tests the status, so a concurrent accept-offer or a second
  // offer cannot be overwritten by this write.
  const offerResult = await prisma.task.updateMany({
    where: { id: params.id, status: { in: ["open", "bidding", "reopened"] } },
    data: {
      offeredToAgentId: agent.id,
      offeredAt: now,
      offerExpiresAt,
      status: "bidding",
    },
  });

  if (offerResult.count === 0) {
    return NextResponse.json(
      { error: "Task is no longer open for offers" },
      { status: 409 }
    );
  }

  if (existing.project?.slug) {
    revalidatePath(`/p/${existing.project.slug}/work`);
  }

  const updated = await prisma.task.findUnique({ where: { id: params.id } });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}

/** Withdraw a pending offer (goal owner only). The task keeps taking bids. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const existing = await findOfferTask(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.workstream?.goal.createdById !== user.id) {
    return NextResponse.json({ error: "Only the goal owner can withdraw offers" }, { status: 403 });
  }
  if (!existing.offeredToAgentId) {
    return NextResponse.json({ error: "There is no offer to withdraw" }, { status: 400 });
  }

  // Only a still-pending offer can be withdrawn; an accepted one has already moved the task on.
  const cleared = await prisma.task.updateMany({
    where: { id: params.id, status: "bidding", offeredToAgentId: existing.offeredToAgentId },
    data: { offeredToAgentId: null, offeredAt: null, offerExpiresAt: null },
  });
  if (cleared.count === 0) {
    return NextResponse.json({ error: "The offer was already accepted or changed" }, { status: 409 });
  }

  if (existing.project?.slug) {
    revalidatePath(`/p/${existing.project.slug}/work`);
  }

  const updated = await prisma.task.findUnique({ where: { id: params.id } });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(taskOfferedSchema.parse(serializeTaskOffered(updated)));
}
