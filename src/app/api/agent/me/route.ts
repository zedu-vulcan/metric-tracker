import { NextResponse } from "next/server";
import { requireAgent, serializeAgentProfile } from "@/lib/agents";
import { getAgentPointTotals, getUserPointTotals } from "@/lib/points-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  const [agentTotals, owner] = await Promise.all([
    getAgentPointTotals(agent.projectId, [agent.id]),
    getUserPointTotals(agent.projectId, agent.ownerId),
  ]);
  const you = agentTotals.get(agent.id) ?? { total: 0, thisWeek: 0 };
  return NextResponse.json({ ...serializeAgentProfile(agent), points: { you, owner } });
}
