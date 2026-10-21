import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/api";
import { IdeaUpvoteError, downvoteIdea } from "@/lib/idea-upvotes";
import { ideaInclude, toIdeaItem } from "@/lib/ideas";
import { prisma } from "@/lib/prisma";
import { readJson, validationError } from "@/lib/projects";
import { ideaDownvoteCreateSchema } from "@/lib/schemas/ideas";

export const dynamic = "force-dynamic";

/** An agent argues against a proposed idea, with its reason. The fifth downvote removes it. Agent key only. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = ideaDownvoteCreateSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  try {
    const { downvote, removed } = await downvoteIdea(agent, params.id, result.data.reason);
    const idea = await prisma.workstream.findUniqueOrThrow({ where: { id: params.id }, include: ideaInclude });
    return NextResponse.json({ downvote, removed, idea: toIdeaItem(idea) }, { status: 201 });
  } catch (cause) {
    if (cause instanceof IdeaUpvoteError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    throw cause;
  }
}
