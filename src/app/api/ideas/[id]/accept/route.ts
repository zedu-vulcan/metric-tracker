import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { payIdeaAccepted } from "@/lib/idea-upvotes";
import { ideaInclude, toIdeaItem } from "@/lib/ideas";
import { getMembership, hasRole } from "@/lib/projects";
import { ideaItemSchema } from "@/lib/schemas/ideas";
import type { z } from "@/lib/zod";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // Only the goal's owner or a project admin decides its ideas; accepting promotes the record to an active workstream.
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id } = params;

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idea = await prisma.workstream.findUnique({
    where: { id },
    include: {
      goal: { select: { createdById: true, projectId: true, project: { select: { slug: true } } } },
      proposedByAgent: { select: { id: true, ownerId: true } },
    },
  });
  if (!idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  // Conflict-of-interest check: you cannot approve an idea proposed by your own agent
  if (idea.proposedByAgent?.ownerId === userId) {
    return NextResponse.json(
      { error: "Conflict of interest: you cannot accept an idea proposed by your own agent" },
      { status: 403 }
    );
  }

  const isGoalOwner = idea.goal.createdById === userId;
  const membership = await getMembership(userId, idea.goal.projectId);
  const isProjectAdmin = membership ? hasRole(membership.role, "admin") : false;

  if (!isGoalOwner && !isProjectAdmin) {
    return NextResponse.json(
      { error: "Only the goal owner or a project admin can decide its ideas" },
      { status: 403 }
    );
  }

  if (idea.status === "accepted") {
    return NextResponse.json({ error: "Idea has already been accepted" }, { status: 400 });
  }
  if (idea.status === "rejected") {
    return NextResponse.json({ error: "Idea was rejected and cannot be accepted" }, { status: 400 });
  }

  // The WHERE clause re-tests the status, so a concurrent accept/reject cannot be overwritten.
  // Accepting pays the proposer's owner in the same transaction.
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.workstream.updateMany({
      where: { id, status: "proposed" },
      data: { status: "accepted", acceptedById: userId },
    });
    if (updated.count === 1) await payIdeaAccepted(tx, id);
    return updated;
  });

  if (result.count === 0) {
    const current = await prisma.workstream.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    if (current.status === "accepted") {
      return NextResponse.json({ error: "Idea has already been accepted" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Idea was rejected and cannot be accepted" },
      { status: 409 }
    );
  }

  if (idea.goal.project?.slug) {
    revalidatePath(`/p/${idea.goal.project.slug}/work`);
  }

  const accepted = await prisma.workstream.findUnique({
    where: { id },
    include: ideaInclude,
  });
  if (!accepted) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const body = toIdeaItem(accepted) satisfies z.infer<typeof ideaItemSchema>;
  return NextResponse.json(body);
}
