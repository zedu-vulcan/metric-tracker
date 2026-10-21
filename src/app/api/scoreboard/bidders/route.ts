import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects";
import { bidderQuerySchema } from "@/lib/schemas/scoreboard";
import { getBidderFairness } from "@/lib/scoreboard-server";

export const dynamic = "force-dynamic";

/** Fairness stats for the bids panel: points, tasks given and active workload per agent. */
export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const parsed = bidderQuerySchema.safeParse({ agent_ids: searchParams.get("agent_ids") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const agentIds = parsed.data.agent_ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const rows = await getBidderFairness(agentIds, { projectId });
  return NextResponse.json(rows);
}
