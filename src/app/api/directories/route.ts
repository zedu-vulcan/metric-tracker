import { NextResponse } from "next/server";
import {
  dateFromInput,
  defaultChecklist,
  displayName,
  isSubmittedStatus,
  serializeDirectory,
  statusToDb,
  todayDate,
  withChecklist,
} from "@/lib/directories";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { directoryCreateSchema } from "@/lib/schemas/directories";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const directories = await prisma.directory.findMany({
    where: { projectId },
    include: withChecklist,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(directories.map(serializeDirectory));
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

  const result = directoryCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = result.data;
  const status = statusToDb(data.status);
  const directory = await prisma.$transaction(async (tx) => {
    const created = await tx.directory.create({
      data: {
        projectId,
        name: data.name,
        website: data.website,
        status,
        priority: data.priority,
        dateSubmitted: data.dateSubmitted
          ? dateFromInput(data.dateSubmitted)
          : isSubmittedStatus(status)
            ? todayDate()
            : null,
        listingUrl: data.listingUrl || null,
        notes: data.notes || null,
        checklistItems: { create: defaultChecklist() },
      },
      include: withChecklist,
    });
    const name = displayName(created);
    await tx.directoryActivity.create({
      data: {
        projectId,
        directoryId: created.id,
        directoryName: name,
        message: status === "NotSubmitted" ? `${name} added to the shortlist` : `${name} added as ${data.status}`,
        status,
      },
    });
    return created;
  });

  return NextResponse.json(serializeDirectory(directory), { status: 201 });
}
