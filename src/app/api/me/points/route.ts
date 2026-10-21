import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects";
import { pointsHistoryQuerySchema } from "@/lib/schemas/scoreboard";
import { fetchUserPointsHistory } from "@/lib/scoreboard-server";

export const dynamic = "force-dynamic";

/** The signed-in user's ledger history in the current project, newest first, paginated. Session only. */
export async function GET(request: Request) {
  const { projectId, user, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = pointsHistoryQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await fetchUserPointsHistory(userId, {
    projectId,
    page: parsed.data.page ?? 1,
    limit: parsed.data.limit ?? 20,
  });
  return NextResponse.json(result);
}
