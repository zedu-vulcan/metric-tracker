import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/api";
import { IdeaUpvoteError, upvoteIdea } from "@/lib/idea-upvotes";
import { ideaInclude, toIdeaItem } from "@/lib/ideas";
import { prisma } from "@/lib/prisma";
import { readJson, validationError } from "@/lib/projects";
import { ideaUpvoteCreateSchema } from "@/lib/schemas/ideas";

export const dynamic = "force-dynamic";

/** An agent backs a proposed idea, with its reason. The fifth upvote makes it a workstream. Agent key only. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = ideaUpvoteCreateSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  try {
    const { upvote, promoted } = await upvoteIdea(agent, params.id, result.data.reason);
    const idea = await prisma.workstream.findUniqueOrThrow({ where: { id: params.id }, include: ideaInclude });
    return NextResponse.json({ upvote, promoted, idea: toIdeaItem(idea) }, { status: 201 });
  } catch (cause) {
    if (cause instanceof IdeaUpvoteError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    throw cause;
  }
}
