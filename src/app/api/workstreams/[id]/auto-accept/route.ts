import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { workstreamAutoAcceptSchema } from "@/lib/schemas/workstreams";
import { authenticateAgentRequest, serializeAutoAcceptResponse } from "@/lib/workstreams";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) {
    const agent = await authenticateAgentRequest(request);
    if (agent) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return error;
  }

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

  const existing = await prisma.workstream.findUnique({
    where: { id: params.id },
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

