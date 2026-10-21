import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { joinProject, normalizeJoinCode, readJson, serializeProject, validationError } from "@/lib/projects";
import { projectJoinSchema } from "@/lib/schemas/projects";

export const dynamic = "force-dynamic";

/** Join a project with its code or invite-link token. Joining a project you're already in is a no-op. */
export async function POST(request: Request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = projectJoinSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  const { code, token } = result.data;
  const project = await prisma.project.findUnique({
    where: code ? { joinCode: normalizeJoinCode(code) } : { inviteToken: token },
  });
  if (!project) {
    return NextResponse.json(
      { error: code ? "That code doesn't match a project. Check it with whoever shared it." : "This invite link is no longer valid." },
      { status: 404 }
    );
  }

  const membership = await joinProject(user.id, project.id);
  const memberCount = await prisma.projectMember.count({ where: { projectId: project.id } });
  return NextResponse.json(serializeProject(project, membership.role, memberCount));
}
