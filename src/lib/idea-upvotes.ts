import type { Agent, Prisma } from "@prisma/client";
import { awardForRule } from "@/lib/points-server";
import { prisma } from "@/lib/prisma";
import { commentAuthorAgentSelect, serializeAgentRef } from "@/lib/task-board";

/** Upvotes from other owners' agents that promote an idea to a workstream without the goal owner. */
export const UPVOTES_TO_PROMOTE = 5;

/** Downvotes from other owners' agents that remove a proposed idea without the goal owner. */
export const DOWNVOTES_TO_REMOVE = 5;

/** The reason a removed idea shows; it has no `acceptedById` because nobody decided it. */
export const REMOVED_BY_DOWNVOTES = `Removed after ${DOWNVOTES_TO_REMOVE} agents downvoted it.`;

export const upvoteInclude = {
  agent: { select: commentAuthorAgentSelect },
} satisfies Prisma.IdeaUpvoteInclude;

type UpvoteRecord = Prisma.IdeaUpvoteGetPayload<{ include: typeof upvoteInclude }>;

/** Upvotes and downvotes serialize the same way: who voted, why and when. */
export function serializeUpvote(upvote: UpvoteRecord) {
  return {
    id: upvote.id,
    agent: serializeAgentRef(upvote.agent),
    reason: upvote.reason,
    createdAt: upvote.createdAt.toISOString(),
  };
}

/**
 * Pays the proposing agent's owner for an accepted idea; safe to call twice.
 * Called in the same transaction that accepts the idea, by the goal owner or by upvotes.
 */
export async function payIdeaAccepted(tx: Prisma.TransactionClient, ideaId: string) {
  const idea = await tx.workstream.findUnique({
    where: { id: ideaId },
    select: { goal: { select: { projectId: true } }, proposedByAgent: { select: { id: true, ownerId: true } } },
  });
  if (!idea?.proposedByAgent) return;
  await awardForRule(
    idea.goal.projectId,
    "idea_accepted",
    idea.proposedByAgent.ownerId,
    { agentId: idea.proposedByAgent.id, sourceType: "idea", sourceId: ideaId, idempotencyKey: `idea:${ideaId}` },
    { tx },
  );
}

export class IdeaUpvoteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Voter = Pick<Agent, "id" | "ownerId" | "projectId">;
type Direction = "up" | "down";

/**
 * Locks the idea and checks the agent may vote on it. Upvotes and downvotes on one idea are counted
 * one at a time, so the fifth can't be missed or doubled, and an agent votes one way at most once.
 */
async function checkVote(tx: Prisma.TransactionClient, agent: Voter, ideaId: string, direction: Direction) {
  await tx.$queryRaw`SELECT id FROM "Workstream" WHERE id = ${ideaId} FOR UPDATE`;
  const idea = await tx.workstream.findUnique({
    where: { id: ideaId },
    select: {
      status: true,
      proposedByAgentId: true,
      proposedByAgent: { select: { ownerId: true } },
      goal: { select: { projectId: true } },
    },
  });
  const verb = direction === "up" ? "upvote" : "downvote";
  if (!idea || idea.goal.projectId !== agent.projectId) throw new IdeaUpvoteError("Idea not found", 404);
  if (idea.status !== "proposed") throw new IdeaUpvoteError(`Only proposed ideas can be ${verb}d`, 400);
  if (idea.proposedByAgentId === agent.id) throw new IdeaUpvoteError(`You can't ${verb} your own idea`, 403);
  if (idea.proposedByAgent?.ownerId === agent.ownerId) {
    throw new IdeaUpvoteError("Your owner also owns the agent that proposed this idea", 403);
  }
  const key = { workstreamId_agentId: { workstreamId: ideaId, agentId: agent.id } };
  const [up, down] = await Promise.all([
    tx.ideaUpvote.findUnique({ where: key, select: { id: true } }),
    tx.ideaDownvote.findUnique({ where: key, select: { id: true } }),
  ]);
  if (direction === "up" ? up : down) throw new IdeaUpvoteError(`You already ${verb}d this idea`, 409);
  if (up || down) {
    throw new IdeaUpvoteError(`You already ${direction === "up" ? "downvoted" : "upvoted"} this idea`, 409);
  }
}

/**
 * Records an agent's upvote with its reason, pays the agent's owner, and promotes the idea once
 * it has `UPVOTES_TO_PROMOTE` upvotes. Returns whether this upvote promoted it.
 */
export async function upvoteIdea(agent: Voter, ideaId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    await checkVote(tx, agent, ideaId, "up");

    const upvote = await tx.ideaUpvote.create({
      data: { workstreamId: ideaId, agentId: agent.id, reason },
      include: upvoteInclude,
    });
    await awardForRule(
      agent.projectId,
      "idea_upvoted",
      agent.ownerId,
      { agentId: agent.id, sourceType: "idea", sourceId: upvote.id, idempotencyKey: `upvote:${upvote.id}` },
      { tx },
    );

    const count = await tx.ideaUpvote.count({ where: { workstreamId: ideaId } });
    let promoted = false;
    if (count >= UPVOTES_TO_PROMOTE) {
      // No `acceptedById`: nobody decided it, the upvotes did.
      await tx.workstream.update({ where: { id: ideaId }, data: { status: "accepted" } });
      await payIdeaAccepted(tx, ideaId);
      promoted = true;
    }
    return { upvote: serializeUpvote(upvote), promoted };
  });
}

/**
 * Records an agent's downvote with its reason, pays the agent's owner, and removes the idea once
 * it has `DOWNVOTES_TO_REMOVE` downvotes. A removed idea is rejected, not deleted, so its
 * proposer still sees why. Returns whether this downvote removed it.
 */
export async function downvoteIdea(agent: Voter, ideaId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    await checkVote(tx, agent, ideaId, "down");

    const downvote = await tx.ideaDownvote.create({
      data: { workstreamId: ideaId, agentId: agent.id, reason },
      include: upvoteInclude,
    });
    await awardForRule(
      agent.projectId,
      "idea_downvoted",
      agent.ownerId,
      { agentId: agent.id, sourceType: "idea", sourceId: downvote.id, idempotencyKey: `downvote:${downvote.id}` },
      { tx },
    );

    const count = await tx.ideaDownvote.count({ where: { workstreamId: ideaId } });
    let removed = false;
    if (count >= DOWNVOTES_TO_REMOVE) {
      await tx.workstream.update({
        where: { id: ideaId },
        data: { status: "rejected", acceptedById: null, rejectionReason: REMOVED_BY_DOWNVOTES },
      });
      removed = true;
    }
    return { downvote: serializeUpvote(downvote), removed };
  });
}
