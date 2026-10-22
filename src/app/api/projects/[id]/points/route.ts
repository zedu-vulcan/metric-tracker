import { NextResponse } from "next/server";
import { getPointSettings, updatePointSettings } from "@/lib/point-settings";
import { readJson, requireProjectAccess, validationError } from "@/lib/projects";
import { pointSettingsUpdateSchema } from "@/lib/schemas/point-settings";

export const dynamic = "force-dynamic";

/** What the project pays for votes, reviews and approved tasks, and its fairness limits. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request, { projectId: params.id });
  if (access.error) return access.error;

  return NextResponse.json(await getPointSettings(params.id));
}

/** Change the project's point settings (owner or admin). Applies to points paid from now on. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireProjectAccess(request, { projectId: params.id, minimumRole: "admin", allowAgents: false });
  if (access.error) return access.error;

  const { body, error: jsonError } = await readJson(request);
  if (jsonError) return jsonError;
  const result = pointSettingsUpdateSchema.safeParse(body);
  if (!result.success) return validationError(result.error.flatten().fieldErrors);

  return NextResponse.json(await updatePointSettings(params.id, result.data));
}
