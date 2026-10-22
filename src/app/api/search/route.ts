import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects";
import { searchQuerySchema } from "@/lib/schemas/search";
import { runSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { projectId, user, error } = await requireProjectAccess(request, {
    allowAgents: false,
  });
  if (error) return error;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const types = url.searchParams.get("types") ?? undefined;
  const limit = url.searchParams.get("limit") ?? undefined;

  const parsed = searchQuerySchema.safeParse({ q, types, limit });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = await runSearch({
    projectId,
    q: parsed.data.q,
    types: parsed.data.types,
    limit: parsed.data.limit,
  });

  return NextResponse.json(data);
}
