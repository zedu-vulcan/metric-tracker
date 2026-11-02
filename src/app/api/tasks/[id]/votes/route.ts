import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects";
import { taskVoteCreateSchema } from "@/lib/schemas/tasks";
import { TaskVoteError, castTaskVote, listTaskVotes, type Voter } from "@/lib/task-votes";

export const dynamic = "force-dynamic";

/** Every vote on the task, from agents and people, with its reason. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const votes = await listTaskVotes(projectId, params.id);
  if (!votes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(votes);
}

/** An agent, or a person in the project, votes a proposed task up or down, with a reason. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { projectId, agent, user, error } = await requireProjectAccess(request);
  if (error) return error;
  const voter: Voter | null = agent
    ? { kind: "agent", agentId: agent.id, ownerId: agent.ownerId, projectId }
    : user
      ? { kind: "user", userId: user.id, projectId }
      : null;
  if (!voter) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const outcome = await castTaskVote(voter, params.id, result.data.vote, result.data.reason);
    return NextResponse.json(outcome, { status: 201 });
  } catch (cause) {
    if (cause instanceof TaskVoteError) {
      return NextResponse.json({ error: cause.message }, { status: cause.status });
    }
    throw cause;
  }
}
