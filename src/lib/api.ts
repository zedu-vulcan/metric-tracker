import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import type { Agent } from "@prisma/client";

export type AuthContext =
  | {
      type: "user";
      user: NonNullable<Session["user"]> & { id: string };
      agent: null;
      error: null;
    }
  | {
      type: "agent";
      agent: Agent;
      user: null;
      error: null;
    }
  | {
      type: null;
      user: null;
      agent: null;
      error: NextResponse;
    };

import { hashAgentKey } from "./agents";

/**
 * Extracts the API key from request headers if present.
 * Supports:
 * - `X-Agent-Key: <key>`
 * - `Authorization: Bearer <key>`
 */
export function extractAgentKey(request: Request): string | null {
  const xApiKey = request.headers.get("x-agent-key")?.trim();
  if (xApiKey) return xApiKey;

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  return null;
}

/**
 * Resolves the authenticated caller as either a Human User (via NextAuth session)
 * or an Autonomous Agent (via X-Agent-Key or Bearer token header).
 *
 * For agents:
 * - Looks up the active agent in Prisma by keyHash.
 * - Updates the agent's `lastActiveAt` timestamp asynchronously.
 */
export async function getAuthContext(request?: Request): Promise<AuthContext> {
  if (request) {
    const apiKey = extractAgentKey(request);
    if (apiKey) {
      const agent = await prisma.agent.findUnique({
        where: { keyHash: hashAgentKey(apiKey) },
      });

      if (!agent) {
        return {
          type: null,
          user: null,
          agent: null,
          error: NextResponse.json(
            { error: "Invalid or inactive agent API key" },
            { status: 401 }
          ),
        };
      }

      // Keep lastActiveAt fresh
      await prisma.agent
        .update({
          where: { id: agent.id },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {
          // Ignore non-critical timestamp update errors
        });

      return {
        type: "agent",
        agent,
        user: null,
        error: null,
      };
    }
  }

  // Fallback to human user session (Google Auth)
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return {
      type: null,
      user: null,
      agent: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    type: "user",
    user: {
      ...session.user,
      id: userId,
    },
    agent: null,
    error: null,
  };
}

/**
 * Requires the caller to be a human user. Blocks agent keys with 403 Forbidden.
 */
export async function requireUser(request?: Request) {
  if (request) {
    const apiKey = extractAgentKey(request);
    if (apiKey) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Agents are not permitted to perform this action. Human user required." },
          { status: 403 }
        ),
      };
    }
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    user: {
      ...session.user,
      id: userId,
    },
    error: null,
  };
}

/**
 * Requires the caller to be an agent. Rejects requests without a valid agent API key.
 */
export async function requireAgent(request: Request) {
  const apiKey = extractAgentKey(request);
  if (!apiKey) {
    return {
      agent: null,
      error: NextResponse.json(
        { error: "Agent API key required (use X-Agent-Key or Authorization: Bearer <key>)" },
        { status: 401 }
      ),
    };
  }

  const agent = await prisma.agent.findUnique({
    where: { keyHash: hashAgentKey(apiKey) },
  });

  if (!agent) {
    return {
      agent: null,
      error: NextResponse.json(
        { error: "Invalid or inactive agent API key" },
        { status: 401 }
      ),
    };
  }

  await prisma.agent
    .update({
      where: { id: agent.id },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => {});

  return {
    agent,
    error: null,
  };
}

/**
 * Legacy backwards-compatible helper for existing routes.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

