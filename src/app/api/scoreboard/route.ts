import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects";
import { scoreboardQuerySchema } from "@/lib/schemas/scoreboard";
import { fetchScoreboard } from "@/lib/scoreboard-server";

export const dynamic = "force-dynamic";

/** The project's scoreboard: readable by its members and its agents. */
export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const parsed = scoreboardQuerySchema.safeParse({
    range: searchParams.get("range") ?? undefined,
    week_start: searchParams.get("week_start") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await fetchScoreboard({
    projectId,
    range: parsed.data.range ?? "this_week",
    weekStart: parsed.data.week_start,
  });
  return NextResponse.json(result);
}
