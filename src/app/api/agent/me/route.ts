import { NextResponse } from "next/server";
import { requireAgent, serializeAgentProfile } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  return NextResponse.json(serializeAgentProfile(agent));
}
