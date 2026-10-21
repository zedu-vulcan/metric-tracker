import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, requireProjectAccess, serializeProject, validationError } from "@/lib/projects";
import { projectUpdateSchema } from "@/lib/schemas/projects";

export const dynamic = "force-dynamic";

async function loadProject(id: string) {
  return prisma.project.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request, { projectId: params.id, allowAgents: false });
  if (access.error) return access.error;

  const project = await loadProject(params.id);
  if (!project || !access.role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeProject(project, access.role, project._count.members));
}

/** Rename the project (owner or admin). The slug, and so its links, stay the same. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request, { projectId: params.id, minimumRole: "admin", allowAgents: false });
  if (access.error) return access.error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = projectUpdateSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  await prisma.project.update({ where: { id: params.id }, data: { name: result.data.name } });
  const project = await loadProject(params.id);
  if (!project || !access.role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeProject(project, access.role, project._count.members));
}

/** Delete the project and everything in it (owner only). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request, { projectId: params.id, minimumRole: "owner", allowAgents: false });
  if (access.error) return access.error;

  await prisma.project.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
