import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole, requireProjectAccess } from "@/lib/projects";
import { taskTypeCreateSchema } from "@/lib/schemas/task-types";
import {
  createTaskType,
  prismaTaskTypesStore,
  serializeTaskType,
  taskTypeMutationResponse,
} from "@/lib/task-types-server";

export const dynamic = "force-dynamic";

/** The project's active task types. Readable by its members and its agents. */
export async function GET(request: Request) {
  const { projectId, role, error } = await requireProjectAccess(request);
  if (error) return error;
  const store = prismaTaskTypesStore(prisma, projectId);
  const isAdmin = role !== null && hasRole(role, "admin");

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("include_archived") === "true";
  if (includeArchived && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const types = await store.list(includeArchived);
  return NextResponse.json(types.map(serializeTaskType));
}

/** Create a task type: project owners and admins only. */
export async function POST(request: Request) {
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

  const parsed = taskTypeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const store = prismaTaskTypesStore(prisma, projectId);
  const result = await createTaskType(store, parsed.data, { isAdmin: true, userId });
  return taskTypeMutationResponse(result, true);
}
