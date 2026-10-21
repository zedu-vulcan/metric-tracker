import { NextResponse } from "next/server";
import { serializeActivity } from "@/lib/directories";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { activityQuerySchema } from "@/lib/schemas/directories";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const result = activityQuerySchema.safeParse({ limit: searchParams.get("limit") ?? undefined });
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", details: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const activity = await prisma.directoryActivity.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: result.data.limit,
  });
  return NextResponse.json(activity.map(serializeActivity));
}
