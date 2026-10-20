import { NextResponse } from "next/server";
import { generateAgentKey, serializeAgent } from "@/lib/agents";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Issues a new key. The old key stops working immediately; the new one is returned only in this response. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.agent.findFirst({
    where: { id: params.id, ownerId: userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { key, keyHash, keyHint } = generateAgentKey();
  const updated = await prisma.agent.update({ where: { id: params.id }, data: { keyHash, keyHint } });

  return NextResponse.json({ ...serializeAgent(updated), key });
}
