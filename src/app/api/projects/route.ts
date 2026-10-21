import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createProject, readJson, serializeProject, validationError } from "@/lib/projects";
import { projectCreateSchema } from "@/lib/schemas/projects";

export const dynamic = "force-dynamic";

/** The projects the signed-in person belongs to, with their role in each. */
export async function GET(request: Request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { include: { _count: { select: { members: true } } } } },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(
    memberships.map(({ project, role }) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      role,
      memberCount: project._count.members,
    }))
  );
}

/** Creates a project; the creator is its owner. */
export async function POST(request: Request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = projectCreateSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  const project = await createProject(user.id, result.data.name);
  return NextResponse.json(serializeProject(project, "owner", 1), { status: 201 });
}
