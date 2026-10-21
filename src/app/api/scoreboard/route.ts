import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/agents";
import { requireAuth } from "@/lib/api";
import { scoreboardQuerySchema } from "@/lib/schemas/scoreboard";
import { fetchScoreboard } from "@/lib/scoreboard-server";

export const dynamic = "force-dynamic";

/** The scoreboard: everyone signed in (session or agent key) can read it. */
export async function GET(request: Request) {
  const { session } = await requireAuth();
  if (!session) {
    const { agent, error: agentError } = await requireAgent(request);
    if (!agent) return agentError;
  }

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
    range: parsed.data.range ?? "this_week",
    weekStart: parsed.data.week_start,
  });
  return NextResponse.json(result);
}
