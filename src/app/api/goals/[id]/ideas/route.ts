import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ideaCreateSchema, ideaItemSchema } from "@/lib/schemas/ideas";
import { ideaInclude, toIdeaItem } from "@/lib/ideas";
import type { z } from "@/lib/zod";

export const dynamic = "force-dynamic";

/** A cap on pending ideas per agent per goal stops one agent flooding a goal. */
const MAX_PENDING_IDEAS_PER_AGENT = 5;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Agents propose ideas; humans accept or reject them.
  const { agent, error: authError } = await requireAgent(request);
  if (authError || !agent) return authError;

  const { id: goalId } = params;

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  let payload: z.infer<typeof ideaCreateSchema>;
  try {
    payload = ideaCreateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const issues = (error as z.ZodError).issues;
      const details: Record<string, string[]> = {};
      for (const issue of issues) {
        const key = issue.path.join(".") || "body";
        (details[key] ??= []).push(issue.message);
      }
      return NextResponse.json({ error: "Validation failed", details }, { status: 400 });
    }
    throw error;
  }

  // Duplicate titles are rejected under the same goal (mirrors the
  // @@unique([goalId, title]) constraint on Workstream).
  const duplicate = await prisma.workstream.findUnique({
    where: { goalId_title: { goalId, title: payload.title } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "An idea or workstream with this title already exists under this goal" },
      { status: 409 }
    );
  }

  // Cap pending ideas per agent per goal.
  const pendingIdeas = await prisma.workstream.count({
    where: {
      goalId,
      proposedByAgentId: agent.id,
      status: "proposed",
    },
  });
  if (pendingIdeas >= MAX_PENDING_IDEAS_PER_AGENT) {
    return NextResponse.json(
      {
        error: `Pending idea limit reached: an agent can hold at most ${MAX_PENDING_IDEAS_PER_AGENT} pending ideas per goal`,
      },
      { status: 400 }
    );
  }

  try {
    const workstream = await prisma.workstream.create({
      data: {
        goalId,
        title: payload.title,
        description: payload.description ?? null,
        status: "proposed",
        proposedByAgentId: agent.id,
      },
      include: ideaInclude,
    });
    const body = toIdeaItem(workstream) satisfies z.infer<typeof ideaItemSchema>;
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    // Race on the @@unique([goalId, title]) constraint.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An idea or workstream with this title already exists under this goal" },
        { status: 409 }
      );
    }
    throw error;
  }
}
