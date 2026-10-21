import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/agents";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskTypeCreateSchema } from "@/lib/schemas/task-types";
import {
  createTaskType,
  prismaTaskTypesStore,
  serializeTaskType,
  type TaskTypeMutationResult,
} from "@/lib/task-types-server";

export const dynamic = "force-dynamic";

/** Active task types. Readable with a Google session OR an agent key. */
export async function GET(request: Request) {
  const store = prismaTaskTypesStore(prisma);

  const { session } = await requireAuth();
  let isAdmin = false;
  if (session) {
    const userId = (session.user as { id?: string }).id;
    if (userId) isAdmin = await store.userIsPlatformAdmin(userId);
  } else {
    const { agent, error: agentError } = await requireAgent(request);
    if (!agent) return agentError;
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("include_archived") === "true";
  if (includeArchived && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const types = await store.list(includeArchived);
  return NextResponse.json(types.map(serializeTaskType));
}

/** Create a task type — platform admins only, enforced server-side. */
export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as { id?: string }).id;
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

  const store = prismaTaskTypesStore(prisma);
  if (!(await store.userIsPlatformAdmin(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await createTaskType(store, parsed.data, { isAdmin: true, userId });
  return taskTypeMutationResponse(result, true);
}

export function taskTypeMutationResponse(result: TaskTypeMutationResult, created = false) {
  if (result.status === "ok") {
    return NextResponse.json(serializeTaskType(result.type), { status: created ? 201 : 200 });
  }
  if (result.status === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    { error: "Validation failed", details: { _errors: result.errors } },
    { status: 400 }
  );
}
