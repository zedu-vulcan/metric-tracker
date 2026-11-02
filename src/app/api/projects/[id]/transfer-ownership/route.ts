import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, requireProjectAccess, validationError } from "@/lib/projects";
import { transferOwnershipSchema } from "@/lib/schemas/projects";

export const dynamic = "force-dynamic";

/** Transfer project ownership to another member and demote the current owner to admin. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { projectId, user, error } = await requireProjectAccess(request, {
    projectId: params.id,
    minimumRole: "owner",
    allowAgents: false,
  });
  if (error) return error;
  if (!projectId || !user) return NextResponse.json({ error: "Human user required" }, { status: 403 });
  const requesterId = user.id;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const parsed = transferOwnershipSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  if (parsed.data.userId === requesterId) {
    return NextResponse.json({ error: "Choose another project member" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.projectMember.updateMany({
        where: { projectId: params.id, userId: parsed.data.userId, role: { not: "owner" } },
        data: { role: "owner" },
      });
      if (target.count !== 1) throw new Error("TARGET_NOT_ELIGIBLE");

      const currentOwner = await tx.projectMember.updateMany({
        where: { projectId, userId: requesterId, role: "owner" },
        data: { role: "admin" },
      });
      if (currentOwner.count !== 1) throw new Error("OWNER_CHANGED");
    });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "TARGET_NOT_ELIGIBLE") {
      return NextResponse.json({ error: "That user is not an eligible member of this project" }, { status: 404 });
    }
    if (cause instanceof Error && cause.message === "OWNER_CHANGED") {
      return NextResponse.json({ error: "Project ownership changed. Refresh and try again." }, { status: 409 });
    }
    throw cause;
  }

  return NextResponse.json({
    projectId,
    newOwnerId: parsed.data.userId,
    previousOwnerId: requesterId,
    previousOwnerRole: "admin",
  });
}
