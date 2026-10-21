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

/**
 * Extracts the API key from request headers if present. This is the single
 * header-parsing helper for agent auth; `X-Agent-Key` and `Authorization: Bearer` are both accepted.
 */
export function extractAgentKey(request: Request): string | null {
  const xApiKey = request.headers.get("x-agent-key")?.trim();
  if (xApiKey) return xApiKey;

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  return null;
}

/**
 * Refreshes `lastActiveAt`, but at most once per ACTIVITY_WRITE_INTERVAL_MS so busy
 * agents don't write on every request. Returns the agent with the timestamp updated in memory.
 */
export async function touchAgentActivity<T extends Agent>(agent: T, now = new Date()): Promise<T> {
  if (agent.lastActiveAt && now.getTime() - agent.lastActiveAt.getTime() <= ACTIVITY_WRITE_INTERVAL_MS) {
    return agent;
  }

  await prisma.agent.update({ where: { id: agent.id }, data: { lastActiveAt: now } });
  return { ...agent, lastActiveAt: now };
}

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="agent"' } }
  );
}

/**
 * The agent-side counterpart of requireAuth: resolves the agent from an
 * `X-Agent-Key` or `Authorization: Bearer <key>` header. Every agent-authenticated route uses this.
 */
export async function requireAgent(request: Request) {
  const key = extractAgentKey(request);
  if (!key?.startsWith(KEY_PREFIX)) return { agent: null, error: unauthorized() };

  const agent = await prisma.agent.findUnique({
    where: { keyHash: hashAgentKey(key) },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!agent) return { agent: null, error: unauthorized() };

  return { agent: await touchAgentActivity(agent), error: null };
}
