import { NextResponse } from "next/server";
import {
  dateFromInput,
  displayName,
  isSubmittedStatus,
  serializeDirectory,
  statusMessage,
  statusToDb,
  todayDate,
  withChecklist,
} from "@/lib/directories";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { directoryUpdateSchema } from "@/lib/schemas/directories";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const directory = await prisma.directory.findFirst({ where: { id: params.id, projectId }, include: withChecklist });
  if (!directory) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeDirectory(directory));
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 });
  }

  const result = directoryUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.directory.findFirst({ where: { id: params.id, projectId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ((result.data.name ?? existing.name) === "" && (result.data.website ?? existing.website) === "") {
    return NextResponse.json(
      { error: "Validation failed", details: { name: ["Add a name or a website so you can recognise it later."] } },
      { status: 400 }
    );
  }

  const data = result.data;
  const nextStatus = data.status !== undefined ? statusToDb(data.status) : existing.status;
  const statusChanged = nextStatus !== existing.status;
  const listingAdded = Boolean(data.listingUrl) && !existing.listingUrl;

  const directory = await prisma.$transaction(async (tx) => {
    const updated = await tx.directory.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.listingUrl !== undefined && { listingUrl: data.listingUrl || null }),
        ...(statusChanged && { status: nextStatus }),
        ...(data.dateSubmitted !== undefined
          ? { dateSubmitted: data.dateSubmitted ? dateFromInput(data.dateSubmitted) : null }
          : statusChanged && isSubmittedStatus(nextStatus) && !existing.dateSubmitted
            ? { dateSubmitted: todayDate() }
            : {}),
      },
      include: withChecklist,
    });
    const name = displayName(updated);
    if (statusChanged) {
      await tx.directoryActivity.create({
        data: {
          projectId,
          directoryId: updated.id,
          directoryName: name,
          message: statusMessage(name, nextStatus),
          status: nextStatus,
        },
      });
    } else if (listingAdded) {
      await tx.directoryActivity.create({
        data: {
          projectId,
          directoryId: updated.id,
          directoryName: name,
          message: `${name} listing link added`,
          status: updated.status,
        },
      });
    }
    return updated;
  });

  return NextResponse.json(serializeDirectory(directory));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const existing = await prisma.directory.findFirst({
    where: { id: params.id, projectId },
    select: { id: true, name: true, website: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = displayName(existing);
  await prisma.$transaction([
    prisma.directory.delete({ where: { id: existing.id } }),
    prisma.directoryActivity.create({ data: { projectId, directoryName: name, message: `${name} removed from the list` } }),
  ]);

  return new NextResponse(null, { status: 204 });
}
