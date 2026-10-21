import { NextResponse } from "next/server";
import { APIError } from "openai";
import { getOverview } from "@/lib/overview";
import { prisma } from "@/lib/prisma";
import { projectHref } from "@/lib/project-paths";
import { requireProjectAccess } from "@/lib/projects";
import { AiNotConfiguredError, generateOverviewSummary } from "@/lib/overview-summary";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  try {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { slug: true } });
    const summary = await generateOverviewSummary(await getOverview(projectId, projectHref(project.slug)));
    return NextResponse.json(summary);
  } catch (cause) {
    if (cause instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: "AI summaries aren't set up yet. Ask an admin to add the AI key and model." }, { status: 503 });
    }
    console.error("Overview summary failed", cause);
    if (cause instanceof APIError && cause.code === "model_not_found") {
      return NextResponse.json({ error: "The AI model in AI_MODEL isn't available on this provider. Ask an admin to change it." }, { status: 502 });
    }
    return NextResponse.json({ error: "The AI service didn't return a usable summary. Try again." }, { status: 502 });
  }
}
