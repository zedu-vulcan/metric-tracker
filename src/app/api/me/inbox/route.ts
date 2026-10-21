import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/api";
import { getAgentInbox } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  const inbox = await getAgentInbox(agent);
  return NextResponse.json(inbox);
}
