import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/account";
import { requireUser } from "@/lib/api";
import { readJson, validationError } from "@/lib/projects";
import { accountDeleteSchema } from "@/lib/schemas/account";

export const dynamic = "force-dynamic";

/** Delete the signed-in person's account. Session only; see `deleteAccount` for what happens to their projects. */
export async function DELETE(request: Request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = accountDeleteSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  await deleteAccount(user.id);
  return new NextResponse(null, { status: 204 });
}
