import { NextResponse } from "next/server";
import { serializeOutlet, tierToDb } from "@/lib/media";
import { outletKey } from "@/lib/outlet-key";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { outletUpdateSchema } from "@/lib/schemas/media";

export const dynamic = "force-dynamic";

/** Updates an outlet's details. Renaming it also renames the outlet on its coverage and pitches. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 });
  }

  const result = outletUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.pressOutlet.findFirst({ where: { id: params.id, projectId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = result.data;
  const nextKey = data.name !== undefined ? outletKey(data.name) : existing.key;
  if (!nextKey) {
    return NextResponse.json({ error: "Validation failed", details: { name: ["Give the outlet a name."] } }, { status: 400 });
  }
  if (nextKey !== existing.key) {
    const clash = await prisma.pressOutlet.findUnique({ where: { projectId_key: { projectId, key: nextKey } }, select: { id: true } });
    if (clash) {
      return NextResponse.json(
        { error: "Validation failed", details: { name: ["Another outlet already uses that name."] } },
        { status: 400 }
      );
    }
  }

  const outlet = await prisma.$transaction(async (tx) => {
    const updated = await tx.pressOutlet.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name, key: nextKey }),
        ...(data.website !== undefined && { website: data.website || null }),
        ...(data.contactName !== undefined && { contactName: data.contactName || null }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
        ...(data.tier !== undefined && { tier: tierToDb(data.tier) }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });
    if (data.name !== undefined && data.name !== existing.name) {
      await tx.pressCoverage.updateMany({ where: { outletId: existing.id }, data: { outlet: data.name } });
      await tx.pressSubmission.updateMany({ where: { outletId: existing.id }, data: { outlet: data.name } });
    }
    return updated;
  });

  return NextResponse.json(serializeOutlet(outlet));
}
