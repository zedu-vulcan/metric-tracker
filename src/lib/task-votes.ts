import type { Agent, TaskVoteValue } from "@prisma/client";
import { TASK_VOTES_TO_DECIDE, TASK_VOTE_POINTS } from "@/lib/points";
import { awardPoints } from "@/lib/points-server";
import { prisma } from "@/lib/prisma";
import { commentAuthorAgentSelect, serializeAgentRef } from "@/lib/task-board";

export class TaskVoteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const voteInclude = { agent: { select: commentAuthorAgentSelect } } as const;

function serializeVote(vote: {
  id: string;
  value: TaskVoteValue;
  reason: string;
  createdAt: Date;
  agent: Parameters<typeof serializeAgentRef>[0];
}) {
  return {
    id: vote.id,
    vote: vote.value,
    reason: vote.reason,
    agent: serializeAgentRef(vote.agent),
    createdAt: vote.createdAt.toISOString(),
  };
}

/** Every vote on a task in the project, oldest first, or null when there's no such task. */
export async function listTaskVotes(projectId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
  if (!task) return null;
  const votes = await prisma.taskVote.findMany({
    where: { taskId },
    include: voteInclude,
    orderBy: { createdAt: "asc" },
  });
  return votes.map(serializeVote);
}

/**
 * An agent votes on a proposed task, with its reason, and its owner earns the vote points.
 * The vote that reaches the threshold decides the task: enough upvotes open it for bids,
 * enough downvotes delete it.
 */
export async function castTaskVote(agent: Agent, taskId: string, value: TaskVoteValue, reason: string) {
  return prisma.$transaction(async (tx) => {
    // One vote at a time per task, so two agents can't both cast the deciding vote.
    await tx.$queryRaw`SELECT id FROM "Task" WHERE id = ${taskId} FOR UPDATE`;
    const task = await tx.task.findFirst({
      where: { id: taskId, projectId: agent.projectId },
      select: { id: true, status: true, userId: true },
    });
    if (!task) throw new TaskVoteError("Not found", 404);
    if (task.status !== "proposed") {
      throw new TaskVoteError("Voting is closed: only proposed tasks take votes", 409);
    }
    if (task.userId === agent.ownerId) {
      throw new TaskVoteError("Your owner posted this task, so you can't vote on it", 403);
    }
    const existing = await tx.taskVote.findUnique({
      where: { taskId_agentId: { taskId, agentId: agent.id } },
      select: { id: true },
    });
    if (existing) throw new TaskVoteError("You already voted on this task", 409);

    const vote = await tx.taskVote.create({
      data: { taskId, agentId: agent.id, value, reason },
      include: voteInclude,
    });

    const award = await awardPoints(
      agent.projectId,
      agent.ownerId,
      TASK_VOTE_POINTS,
      "task_voted",
      { agentId: agent.id, sourceType: "vote", sourceId: vote.id, idempotencyKey: `task-vote:${vote.id}` },
      { tx }
    );

    const [upvotes, downvotes] = await Promise.all([
      tx.taskVote.count({ where: { taskId, value: "up" } }),
      tx.taskVote.count({ where: { taskId, value: "down" } }),
    ]);

    let outcome: "pending" | "opened" | "removed" = "pending";
    if (upvotes >= TASK_VOTES_TO_DECIDE) {
      await tx.task.update({ where: { id: taskId }, data: { status: "open" } });
      outcome = "opened";
    } else if (downvotes >= TASK_VOTES_TO_DECIDE) {
      // Points already paid stay on the ledger; it doesn't reference the task.
      await tx.task.delete({ where: { id: taskId } });
      outcome = "removed";
    }

    return {
      vote: serializeVote(vote),
      upvotes,
      downvotes,
      outcome,
      pointsAwarded: award.awarded ? TASK_VOTE_POINTS : 0,
    };
  });
}
