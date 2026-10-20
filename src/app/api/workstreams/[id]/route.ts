import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { authenticateAgentRequest, serializeWorkstreamDetail } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) {
    const agent = await authenticateAgentRequest(request);
    if (!agent) return error;
  }

  const workstream = await prisma.workstream.findUnique({
    where: { id: params.id },
    include: {
      goal: {
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
        },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
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
  });

  if (!workstream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeWorkstreamDetail(workstream));
}

