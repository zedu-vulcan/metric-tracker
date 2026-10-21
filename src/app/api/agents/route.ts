import { NextResponse } from "next/server";
import { generateAgentKey, serializeAgent } from "@/lib/agents";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { agentCreateSchema } from "@/lib/schemas/agents";

export const dynamic = "force-dynamic";

/** The signed-in user's agents in the current project. */
export async function GET(request: Request) {
  const { projectId, user, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    where: { ownerId: userId, projectId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(agents.map(serializeAgent));
}

export async function POST(request: Request) {
  const { projectId, user, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const userId = user?.id;
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
      projectId,
    },
  });

  return NextResponse.json({ ...serializeAgent(agent), key }, { status: 201 });
}
