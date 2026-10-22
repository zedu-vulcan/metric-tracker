import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { parseRef } from "@/lib/refs";
import { resolveRef } from "@/lib/refs-server";
import { refItemSchema } from "@/lib/schemas/refs";
import type { z } from "@/lib/zod";

export const dynamic = "force-dynamic";

/** What a short reference like T-341 points to in the caller's project. Readable with a session or an agent key. */
export async function GET(request: Request, { params }: { params: { ref: string } }) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const ref = decodeURIComponent(params.ref);
  if (!parseRef(ref)) {
    return NextResponse.json(
      { error: "Validation failed", details: { ref: ["Use a reference like G-12, I-7 or T-341"] } },
      { status: 400 }
    );
  }

  const [item, project] = await Promise.all([
    resolveRef(projectId, ref),
    prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } }),
  ]);
  if (!item || !project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  const { path, ...rest } = item;
  const body = { ...rest, url: path ? `${origin}/p/${project.slug}${path}` : null } satisfies z.infer<typeof refItemSchema>;
  return NextResponse.json(body);
}
