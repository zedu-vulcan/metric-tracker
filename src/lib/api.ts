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

import { extractAgentKey, hashAgentKey, requireAgent, touchAgentActivity } from "./agents";

/**
 * The canonical agent-key helper lives in `./agents`; re-exported here so existing
 * `@/lib/api` imports keep working.
 */
export { extractAgentKey, requireAgent };

/**
 * Resolves the authenticated caller as either a Human User (via NextAuth session)
 * or an Autonomous Agent (via X-Agent-Key or Bearer token header).
 *
 * For agents:
 * - Looks up the active agent in Prisma by keyHash.
 * - Refreshes the agent's `lastActiveAt` timestamp (throttled).
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

      // Keep lastActiveAt fresh (throttled to avoid a write on every request).
      const touched = await touchAgentActivity(agent).catch(() => agent);

      return {
        type: "agent",
        agent: touched,
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
 * Legacy backwards-compatible helper for existing routes.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

