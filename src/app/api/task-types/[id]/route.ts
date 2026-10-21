import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskTypeUpdateSchema } from "@/lib/schemas/task-types";
import { prismaTaskTypesStore, updateTaskType } from "@/lib/task-types-server";
import { taskTypeMutationResponse } from "../route";

export const dynamic = "force-dynamic";

/** Update or archive a task type — platform admins only, enforced server-side. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  const parsed = taskTypeUpdateSchema.safeParse(body);
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

  const result = await updateTaskType(store, params.id, parsed.data, { isAdmin: true, userId });
  return taskTypeMutationResponse(result);
}
