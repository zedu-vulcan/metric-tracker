import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { ideaInclude, toIdeaItem } from "@/lib/ideas";
import { ideaItemSchema, ideaRejectSchema } from "@/lib/schemas/ideas";
import type { z } from "@/lib/zod";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Only the goal's owner decides its ideas; rejected ideas stay visible as rejected, with the reason.
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
      goal: {
        select: {
          createdById: true,
          project: { select: { slug: true } },
        },
      },
    },
  });
  if (!idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }
  if (idea.goal.createdById !== userId) {
    return NextResponse.json({ error: "Only the goal owner can decide its ideas" }, { status: 403 });
  }

  // The reason is optional, and so is the body.
  const raw = await request.text();
  let input: unknown = {};
  if (raw.trim()) {
    try {
      input = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
  }
  const parsed = ideaRejectSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (idea.status === "rejected") {
    return NextResponse.json({ error: "Idea has already been rejected" }, { status: 400 });
  }
  if (idea.status === "accepted") {
    return NextResponse.json({ error: "Idea has already been accepted and cannot be rejected" }, { status: 400 });
  }

  // The WHERE clause re-tests the status, so a concurrent accept/reject cannot be overwritten.
  const result = await prisma.workstream.updateMany({
    where: { id, status: "proposed" },
    data: { status: "rejected", acceptedById: userId, rejectionReason: parsed.data.reason || null },
  });

  if (result.count === 0) {
    const current = await prisma.workstream.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    if (current.status === "rejected") {
      return NextResponse.json({ error: "Idea has already been rejected" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Idea has already been accepted and cannot be rejected" },
      { status: 409 }
    );
  }

  if (idea.goal.project?.slug) {
    revalidatePath(`/p/${idea.goal.project.slug}/work`);
  }

  const rejected = await prisma.workstream.findUnique({
    where: { id },
    include: ideaInclude,
  });
  if (!rejected) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const body = toIdeaItem(rejected) satisfies z.infer<typeof ideaItemSchema>;
  return NextResponse.json(body);
}
