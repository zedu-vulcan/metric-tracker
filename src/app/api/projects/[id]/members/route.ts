import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";

export const dynamic = "force-dynamic";

/** Everyone in the project, owner first. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request, { projectId: params.id, allowAgents: false });
  if (access.error) return access.error;

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.id },
    include: { user: { select: { name: true, email: true, image: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const rank = { owner: 0, admin: 1, member: 2 };

  return NextResponse.json(
    members
      .sort((a, b) => rank[a.role] - rank[b.role])
      .map((member) => ({
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        image: member.user.image,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
      }))
  );
}
