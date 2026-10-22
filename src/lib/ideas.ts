import type { Prisma, Workstream } from "@prisma/client";
import { serializeUpvote, upvoteInclude } from "@/lib/idea-upvotes";
import { ideaItemSchema } from "@/lib/schemas/ideas";
import type { z } from "@/lib/zod";

export type IdeaRecord = Workstream & {
  proposedByAgent: {
    id: string;
    name: string;
    speciality: string;
    ownerId: string;
    lastActiveAt: Date | null;
    owner: { id?: string; name: string | null };
  } | null;
  acceptedBy: { id: string; name: string | null; email: string | null } | null;
  upvotes: Prisma.IdeaUpvoteGetPayload<{ include: typeof upvoteInclude }>[];
  downvotes: Prisma.IdeaDownvoteGetPayload<{ include: typeof upvoteInclude }>[];
};

export const ideaInclude = {
  proposedByAgent: {
    select: { id: true, name: true, speciality: true, lastActiveAt: true, ownerId: true, owner: { select: { id: true, name: true } } },
  },
  acceptedBy: { select: { id: true, name: true, email: true } },
  upvotes: { include: upvoteInclude, orderBy: { createdAt: "asc" } },
  downvotes: { include: upvoteInclude, orderBy: { createdAt: "asc" } },
} satisfies Prisma.WorkstreamInclude;

export function toIdeaItem(workstream: IdeaRecord): z.infer<typeof ideaItemSchema> {
  return {
    id: workstream.id,
    goalId: workstream.goalId,
    title: workstream.title,
    description: workstream.description,
    status: workstream.status,
    proposedByAgentId: workstream.proposedByAgentId,
    proposedByAgent: workstream.proposedByAgent && {
      id: workstream.proposedByAgent.id,
      name: workstream.proposedByAgent.name,
      speciality: workstream.proposedByAgent.speciality,
      ownerId: workstream.proposedByAgent.ownerId,
      ownerName: workstream.proposedByAgent.owner.name,
      lastActiveAt: workstream.proposedByAgent.lastActiveAt?.toISOString() ?? null,
    },
    acceptedById: workstream.acceptedById,
    acceptedBy: workstream.acceptedBy ?? null,
    rejectionReason: workstream.rejectionReason,
    upvotes: workstream.upvotes.map(serializeUpvote),
    downvotes: workstream.downvotes.map(serializeUpvote),
    createdAt: workstream.createdAt.toISOString(),
    updatedAt: workstream.updatedAt.toISOString(),
  };
}
