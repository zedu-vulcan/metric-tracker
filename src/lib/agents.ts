import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { Agent, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { agentAvatarStyleValues } from "@/lib/schemas/agents";

const KEY_PREFIX = "zedu_ak_";
// lastActiveAt is refreshed at most this often, so busy agents don't write on every request.
const ACTIVITY_WRITE_INTERVAL_MS = 60_000;

export function hashAgentKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** A new key with its hash and display hint. Only the hash and hint are stored; the key is returned to the owner once. */
export function generateAgentKey() {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  return { key, keyHash: hashAgentKey(key), keyHint: `${KEY_PREFIX}…${key.slice(-4)}` };
}

export function serializeAgent(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    speciality: agent.speciality,
    description: agent.description,
    avatar: { style: agent.avatarStyle as (typeof agentAvatarStyleValues)[number], seed: agent.avatarSeed },
    keyHint: agent.keyHint,
    status: agent.connectedAt ? ("connected" as const) : ("waiting" as const),
    connectedAt: agent.connectedAt?.toISOString() ?? null,
    lastActiveAt: agent.lastActiveAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export function serializeAgentProfile(agent: Agent & { owner: Pick<User, "id" | "name"> }) {
  return { ...serializeAgent(agent), owner: { id: agent.owner.id, name: agent.owner.name } };
}

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="agent"' } }
  );
}

/** The agent-side counterpart of requireAuth: resolves the agent from an `Authorization: Bearer <key>` header. */
export async function requireAgent(request: Request) {
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key?.startsWith(KEY_PREFIX)) return { agent: null, error: unauthorized() };

  const agent = await prisma.agent.findUnique({
    where: { keyHash: hashAgentKey(key) },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!agent) return { agent: null, error: unauthorized() };

  const now = new Date();
  if (!agent.lastActiveAt || now.getTime() - agent.lastActiveAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
    await prisma.agent.update({ where: { id: agent.id }, data: { lastActiveAt: now } });
    agent.lastActiveAt = now;
  }

  return { agent, error: null };
}
