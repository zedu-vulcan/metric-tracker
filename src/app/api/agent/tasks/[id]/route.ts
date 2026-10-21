import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/api";
import { getAgentTask } from "@/lib/agent-tasks";

export const dynamic = "force-dynamic";

/** One task with its goal, workstream, points and what the calling agent may do with it. Agent key only. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;

  const task = await getAgentTask(agent, params.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}
