import { NextResponse } from "next/server";
import { displayName, serializeChecklistItem } from "@/lib/directories";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { checklistItemUpdateSchema } from "@/lib/schemas/directories";

export const dynamic = "force-dynamic";

type Params = { params: { id: string; itemId: string } };

/** Ticks, unticks or renames a checklist item. Logs when the checklist becomes complete. */
export async function PATCH(request: Request, { params }: Params) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 });
  }

  const result = checklistItemUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.directoryChecklistItem.findFirst({
    where: { id: params.itemId, directoryId: params.id, directory: { projectId } },
    include: { directory: { select: { id: true, name: true, website: true, status: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.directoryChecklistItem.update({
      where: { id: existing.id },
      data: {
        ...(result.data.label !== undefined && { label: result.data.label }),
        ...(result.data.done !== undefined && { done: result.data.done }),
      },
    });
    if (result.data.done === true && !existing.done) {
      const remaining = await tx.directoryChecklistItem.count({ where: { directoryId: existing.directoryId, done: false } });
      if (remaining === 0) {
        await tx.directoryActivity.create({
          data: {
            projectId,
            directoryId: existing.directory.id,
            directoryName: displayName(existing.directory),
            message: `${displayName(existing.directory)} is ready to submit: checklist complete`,
            status: existing.directory.status,
          },
        });
      }
    }
    return updated;
  });

  return NextResponse.json(serializeChecklistItem(item));
}

export async function DELETE(request: Request, { params }: Params) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const existing = await prisma.directoryChecklistItem.findFirst({
    where: { id: params.itemId, directoryId: params.id, directory: { projectId } },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.directoryChecklistItem.delete({ where: { id: existing.id } });
  return new NextResponse(null, { status: 204 });
}
