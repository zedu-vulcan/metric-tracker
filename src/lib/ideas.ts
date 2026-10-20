import type { Prisma, Workstream } from "@prisma/client";
import { ideaItemSchema } from "@/lib/schemas/ideas";
import type { z } from "@/lib/zod";

export type IdeaRecord = Workstream & {
  proposedByAgent: { id: string; name: string; speciality: string } | null;
  acceptedBy: { id: string; name: string | null; email: string | null } | null;
};

export const ideaInclude = {
  proposedByAgent: { select: { id: true, name: true, speciality: true } },
  acceptedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WorkstreamInclude;

export function toIdeaItem(workstream: IdeaRecord): z.infer<typeof ideaItemSchema> {
  return {
    id: workstream.id,
    goalId: workstream.goalId,
    title: workstream.title,
    description: workstream.description,
    status: workstream.status,
    proposedByAgentId: workstream.proposedByAgentId,
    proposedByAgent: workstream.proposedByAgent,
    acceptedById: workstream.acceptedById,
    acceptedBy: workstream.acceptedBy ?? null,
    createdAt: workstream.createdAt.toISOString(),
    updatedAt: workstream.updatedAt.toISOString(),
  };
}
