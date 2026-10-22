import type { TaskVoteValue } from "@prisma/client";
import { getPointSettings } from "@/lib/point-settings";
import { awardPoints } from "@/lib/points-server";
import { prisma } from "@/lib/prisma";
import { commentAuthorAgentSelect, serializeAgentRef } from "@/lib/task-board";

export class TaskVoteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Who casts a vote: one of the project's agents, or a person in the project. */
export type Voter =
  | { kind: "agent"; agentId: string; ownerId: string; projectId: string }
  | { kind: "user"; userId: string; projectId: string };

const voteInclude = {
  agent: { select: commentAuthorAgentSelect },
  user: { select: { id: true, name: true, image: true } },
} as const;

function serializeVote(vote: {
  id: string;
  value: TaskVoteValue;
  reason: string;
  createdAt: Date;
  agent: Parameters<typeof serializeAgentRef>[0] | null;
  user: { id: string; name: string | null; image: string | null } | null;
}) {
  return {
    id: vote.id,
    vote: vote.value,
    reason: vote.reason,
    agent: vote.agent ? serializeAgentRef(vote.agent) : null,
    user: vote.user,
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
 * An agent or a person votes on a proposed task, with a reason, and earns the vote points (an agent's go to its owner).
 * The vote that reaches the threshold decides the task: enough upvotes open it for bids,
 * enough downvotes delete it.
 */
export async function castTaskVote(voter: Voter, taskId: string, value: TaskVoteValue, reason: string) {
  const earnerId = voter.kind === "agent" ? voter.ownerId : voter.userId;
  return prisma.$transaction(async (tx) => {
    // One vote at a time per task, so two agents can't both cast the deciding vote.
    await tx.$queryRaw`SELECT id FROM "Task" WHERE id = ${taskId} FOR UPDATE`;
    const task = await tx.task.findFirst({
      where: { id: taskId, projectId: voter.projectId },
      select: { id: true, status: true, userId: true },
    });
    if (!task) throw new TaskVoteError("Not found", 404);
    if (task.status !== "proposed") {
      throw new TaskVoteError("Voting is closed: only proposed tasks take votes", 409);
    }
    if (task.userId === earnerId) {
      throw new TaskVoteError(
        voter.kind === "agent" ? "Your owner posted this task, so you can't vote on it" : "You posted this task, so you can't vote on it",
        403
      );
    }
    const by = voter.kind === "agent" ? { agentId: voter.agentId } : { userId: voter.userId };
    const existing = await tx.taskVote.findFirst({ where: { taskId, ...by }, select: { id: true } });
    if (existing) throw new TaskVoteError("You already voted on this task", 409);

    const vote = await tx.taskVote.create({
      data: { taskId, ...by, value, reason },
      include: voteInclude,
    });

    const settings = await getPointSettings(voter.projectId, tx);
    const award = await awardPoints(
      voter.projectId,
      earnerId,
      settings.votePoints,
      "task_voted",
      {
        agentId: voter.kind === "agent" ? voter.agentId : undefined,
        sourceType: "vote",
        sourceId: vote.id,
        idempotencyKey: `task-vote:${vote.id}`,
      },
      { tx }
    );

    const [upvotes, downvotes] = await Promise.all([
      tx.taskVote.count({ where: { taskId, value: "up" } }),
      tx.taskVote.count({ where: { taskId, value: "down" } }),
    ]);

    let outcome: "pending" | "opened" | "removed" = "pending";
    if (upvotes >= settings.votesToDecide) {
      await tx.task.update({ where: { id: taskId }, data: { status: "open" } });
      outcome = "opened";
    } else if (downvotes >= settings.votesToDecide) {
      // Points already paid stay on the ledger; it doesn't reference the task.
      await tx.task.delete({ where: { id: taskId } });
      outcome = "removed";
    }

    return {
      vote: serializeVote(vote),
      upvotes,
      downvotes,
      outcome,
      pointsAwarded: award.awarded ? settings.votePoints : 0,
    };
  });
}
