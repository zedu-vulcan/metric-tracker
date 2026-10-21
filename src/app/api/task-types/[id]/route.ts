import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { taskTypeUpdateSchema } from "@/lib/schemas/task-types";
import { prismaTaskTypesStore, taskTypeMutationResponse, updateTaskType } from "@/lib/task-types-server";

export const dynamic = "force-dynamic";

/** Update or archive a task type: project owners and admins only. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { projectId, user, error } = await requireProjectAccess(request, { allowAgents: false, minimumRole: "admin" });
  if (error) return error;

  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const parsed = taskTypeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const store = prismaTaskTypesStore(prisma, projectId);
  const result = await updateTaskType(store, params.id, parsed.data, { isAdmin: true, userId });
  return taskTypeMutationResponse(result);
}
