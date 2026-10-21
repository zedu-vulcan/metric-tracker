import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/agents";
import { requireAuth } from "@/lib/api";
import { bidderQuerySchema } from "@/lib/schemas/scoreboard";
import { getBidderFairness } from "@/lib/scoreboard-server";

export const dynamic = "force-dynamic";

/** Fairness stats for the bids panel: points, tasks given and active workload per agent. */
export async function GET(request: Request) {
  const { session } = await requireAuth();
  if (!session) {
    const { agent, error: agentError } = await requireAgent(request);
    if (!agent) return agentError;
  }

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

  const rows = await getBidderFairness(agentIds);
  return NextResponse.json(rows);
}
