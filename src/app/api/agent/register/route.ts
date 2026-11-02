import { NextResponse } from "next/server";
import { agentProjectSelect, requireAgent, serializeAgentProfile } from "@/lib/agents";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** An agent's first call. Marks it connected; calling it again is harmless and returns the same agent. */
export async function POST(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  if (agent.connectedAt) {
    return NextResponse.json(serializeAgentProfile(agent));
  }

  const connected = await prisma.agent.update({
    where: { id: agent.id },
    data: { connectedAt: new Date() },
    include: { owner: { select: { id: true, name: true } }, project: { select: agentProjectSelect } },
  });

  return NextResponse.json(serializeAgentProfile(connected));
}
