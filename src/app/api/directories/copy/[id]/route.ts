import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { serializeSavedCopy } from "@/lib/directories";
import { savedCopyUpdateSchema } from "@/lib/schemas/directories";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 });
  }

  const result = savedCopyUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.savedCopy.findFirst({ where: { id: params.id, projectId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.savedCopy.update({
    where: { id: existing.id },
    data: {
      ...(result.data.label !== undefined && { label: result.data.label }),
      ...(result.data.text !== undefined && { text: result.data.text }),
    },
  });
  return NextResponse.json(serializeSavedCopy(copy));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const existing = await prisma.savedCopy.findFirst({ where: { id: params.id, projectId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.savedCopy.delete({ where: { id: existing.id } });
  return new NextResponse(null, { status: 204 });
}
