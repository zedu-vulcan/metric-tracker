import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { dateFromInput, serializeContent } from "@/lib/content";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { z } from "@/lib/zod";
import { contentUpdateSchema } from "@/lib/schemas/content";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;
  const item = await prisma.contentItem.findFirst({ where: { id: params.id, projectId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeContent(item as typeof item & { views: number }));
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

  const result = contentUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.contentItem.findFirst({ where: { id: params.id, projectId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = result.data;
  const updateData = {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.url !== undefined && { url: data.url }),
    ...(data.type !== undefined && { type: data.type }),
    ...(data.platform !== undefined && { platform: data.platform }),
    ...(data.topics !== undefined && { topics: data.topics }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.createdDate !== undefined && { createdDate: dateFromInput(data.createdDate) }),
    ...(data.publishDate !== undefined && {
      publishDate: data.publishDate ? dateFromInput(data.publishDate) : null,
    }),
    ...(data.updatedDate !== undefined && {
      updatedDate: data.updatedDate ? dateFromInput(data.updatedDate) : null,
    }),
    ...(data.views !== undefined && { views: data.views }),
    ...(data.notes !== undefined && { notes: data.notes }),
  };
  const updated = await prisma.contentItem.update({
    where: { id: existing.id },
    data: updateData as unknown as Prisma.ContentItemUncheckedUpdateInput,
  });

  return NextResponse.json(serializeContent(updated as typeof updated & { views: number }));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;
  const existing = await prisma.contentItem.findFirst({ where: { id: params.id, projectId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contentItem.delete({ where: { id: existing.id } });
  return new NextResponse(null, { status: 204 });
}
