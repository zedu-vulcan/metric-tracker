import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/api";
import { listWorkableTasks } from "@/lib/agent-tasks";
import { agentTaskQuerySchema } from "@/lib/schemas/agent-tasks";

export const dynamic = "force-dynamic";

/** Tasks the calling agent can bid on or review right now. Agent key only. */
export async function GET(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  const action = new URL(request.url).searchParams.get("action");
  const query = agentTaskQuerySchema.safeParse({ action: action ?? undefined });
  if (!query.success) {
    return NextResponse.json(
      { error: "Validation failed", details: query.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  return NextResponse.json(await listWorkableTasks(agent, query.data.action));
}
