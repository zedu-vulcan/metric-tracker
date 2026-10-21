import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { workstreamAutoAcceptSchema } from "@/lib/schemas/workstreams";
import { serializeAutoAcceptResponse } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown = {};
  const rawText = await request.text();
  if (rawText.trim().length > 0) {
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
        { status: 400 }
      );
    }
  }

  const result = workstreamAutoAcceptSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.workstream.findFirst({
    where: { id: params.id, goal: { projectId } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextAutoAccept = result.data.autoAcceptTasks ?? !existing.autoAcceptTasks;

  const updated = await prisma.workstream.update({
    where: { id: params.id },
    data: { autoAcceptTasks: nextAutoAccept },
    select: {
      id: true,
      goalId: true,
      title: true,
      status: true,
      autoAcceptTasks: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(serializeAutoAcceptResponse(updated));
}

