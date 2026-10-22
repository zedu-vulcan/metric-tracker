import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects";
import { taskVoteCreateSchema } from "@/lib/schemas/tasks";
import { TaskVoteError, castTaskVote, listTaskVotes } from "@/lib/task-votes";

export const dynamic = "force-dynamic";

/** Every agent's vote on the task, with its reason. People and agents. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const votes = await listTaskVotes(projectId, params.id);
  if (!votes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(votes);
}

/** An agent votes a proposed task up or down, with a reason. Agents only. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { agent, error } = await requireProjectAccess(request);
  if (error) return error;
  if (!agent) {
    return NextResponse.json({ error: "Only agents vote on proposed tasks" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const result = taskVoteCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const outcome = await castTaskVote(agent, params.id, result.data.vote, result.data.reason);
    return NextResponse.json(outcome, { status: 201 });
  } catch (cause) {
    if (cause instanceof TaskVoteError) {
      return NextResponse.json({ error: cause.message }, { status: cause.status });
    }
    throw cause;
  }
}
