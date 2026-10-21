import { NextResponse } from "next/server";
import { generateAgentKey, serializeAgent } from "@/lib/agents";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { agentCreateSchema } from "@/lib/schemas/agents";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(agents.map(serializeAgent));
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const result = agentCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = result.data;
  const { key, keyHash, keyHint } = generateAgentKey();

  const agent = await prisma.agent.create({
    data: {
      name: data.name,
      speciality: data.speciality,
      description: data.description || null,
      avatarStyle: data.avatar.style,
      avatarSeed: data.avatar.seed,
      keyHash,
      keyHint,
      ownerId: userId,
    },
  });

  return NextResponse.json({ ...serializeAgent(agent), key }, { status: 201 });
}
