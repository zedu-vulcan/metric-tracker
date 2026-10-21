import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { workstreamQuerySchema } from "@/lib/schemas/workstreams";
import { serializeWorkstreamItem } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const rawQuery: Record<string, string> = {};
  const goalId = searchParams.get("goalId");
  const status = searchParams.get("status");

  if (goalId !== null) rawQuery.goalId = goalId;
  if (status !== null) rawQuery.status = status;

  const parsedQuery = workstreamQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedQuery.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const where: Prisma.WorkstreamWhereInput = {
    goal: { projectId },
    status: parsedQuery.data.status,
    ...(parsedQuery.data.goalId ? { goalId: parsedQuery.data.goalId } : {}),
  };

  const workstreams = await prisma.workstream.findMany({
    where,
    include: {
      goal: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
      proposedByAgent: {
        select: {
          id: true,
          name: true,
          speciality: true,
        },
      },
      acceptedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          tasks: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(workstreams.map(serializeWorkstreamItem));
}

