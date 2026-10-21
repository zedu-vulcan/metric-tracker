import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInviteToken, generateJoinCode, requireProjectAccess, serializeProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

/** New join code and invite link (owner or admin). The old ones stop working immediately. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request, { projectId: params.id, minimumRole: "admin", allowAgents: false });
  if (access.error) return access.error;

  const project = await prisma.project.update({
    where: { id: params.id },
    data: { joinCode: generateJoinCode(), inviteToken: generateInviteToken() },
    include: { _count: { select: { members: true } } },
  });
  if (!access.role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeProject(project, access.role, project._count.members));
}
