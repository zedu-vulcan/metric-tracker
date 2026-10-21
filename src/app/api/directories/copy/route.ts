import { NextResponse } from "next/server";
import { serializeSavedCopy } from "@/lib/directories";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { savedCopyCreateSchema } from "@/lib/schemas/directories";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const copies = await prisma.savedCopy.findMany({ where: { projectId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(copies.map(serializeSavedCopy));
}

export async function POST(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 });
  }

  const result = savedCopyCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const last = await prisma.savedCopy.findFirst({ where: { projectId }, orderBy: { position: "desc" }, select: { position: true } });
  const copy = await prisma.savedCopy.create({
    data: { projectId, label: result.data.label, text: result.data.text, position: (last?.position ?? -1) + 1 },
  });
  return NextResponse.json(serializeSavedCopy(copy), { status: 201 });
}
