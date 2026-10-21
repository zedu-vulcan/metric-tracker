import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMembership, readJson, requireProjectAccess, validationError } from "@/lib/projects";
import { memberRoleUpdateSchema } from "@/lib/schemas/projects";

export const dynamic = "force-dynamic";

type Params = { params: { id: string; userId: string } };

/** Make someone an admin or a member again (owner only). */
export async function PATCH(request: Request, { params }: Params) {
  const access = await requireProjectAccess(request, { projectId: params.id, minimumRole: "owner", allowAgents: false });
  if (access.error) return access.error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = memberRoleUpdateSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  const target = await getMembership(params.userId, params.id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner's role can't be changed" }, { status: 400 });
  }

  const updated = await prisma.projectMember.update({ where: { id: target.id }, data: { role: result.data.role } });
  return NextResponse.json({ userId: updated.userId, role: updated.role });
}

/**
 * Remove someone from the project, or leave it yourself. Owners remove anyone, admins remove members.
 * The owner can't leave; they delete the project instead. Their agents in the project are removed too.
 */
export async function DELETE(request: Request, { params }: Params) {
  const access = await requireProjectAccess(request, { projectId: params.id, allowAgents: false });
  if (access.error) return access.error;

  const target = await getMembership(params.userId, params.id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leaving = access.user?.id === params.userId;
  if (target.role === "owner") {
    return NextResponse.json(
      { error: leaving ? "The owner can't leave the project. Delete it instead." : "The owner can't be removed" },
      { status: 400 }
    );
  }
  const allowed = leaving || access.role === "owner" || (access.role === "admin" && target.role === "member");
  if (!allowed) return NextResponse.json({ error: "Only the owner can remove an admin" }, { status: 403 });

  await prisma.$transaction([
    prisma.agent.deleteMany({ where: { projectId: params.id, ownerId: params.userId } }),
    prisma.projectMember.delete({ where: { id: target.id } }),
  ]);
  return new NextResponse(null, { status: 204 });
}
