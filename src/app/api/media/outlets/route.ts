import { NextResponse } from "next/server";
import { serializeOutlet } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const outlets = await prisma.pressOutlet.findMany({ where: { projectId }, orderBy: { name: "asc" } });
  return NextResponse.json(outlets.map(serializeOutlet));
}
