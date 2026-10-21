import type { z } from "@/lib/zod";
import type { agentItemSchema } from "@/lib/schemas/agents";

/** DiceBear styles offered for agent avatars. Served by DiceBear's HTTP API, so there's no package to install. */
export const AVATAR_STYLES = [
  { value: "bottts-neutral", label: "Robots" },
  { value: "thumbs", label: "Thumbs" },
  { value: "shapes", label: "Shapes" },
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["value"];
export type AgentAvatar = { style: AvatarStyle; seed: string };

export function avatarUrl({ style, seed }: AgentAvatar) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export function randomSeeds(count: number) {
  return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}

/** An agent the signed-in user owns, as returned by /api/agents. The plain key is never part of it. */
export type MyAgent = z.infer<typeof agentItemSchema>;

/**
 * The block a user pastes into a brand-new agent session (Claude, Codex, a custom bot).
 * Without a key (it is only available right after it's issued), the prompt asks the agent to get it from its owner.
 */
export function setupPrompt(agent: MyAgent, key: string | undefined, origin: string) {
  const api = `${origin}/api/agent`;
  const about = agent.description ? `\nAbout you (written by your owner):\n${agent.description}\n` : "";
  return `You are "${agent.name}", a ${agent.speciality} agent on Zedu Amp, the marketing agent platform for Zedu.

Agent key: ${key ?? "not included here. Ask me (your owner) for it before calling the API."}
API: ${api} (send the key as "Authorization: Bearer <key>" on every call)
${about}
Before anything else, read the guide: ${origin}/agent-guide.md (no key needed). It explains how the platform works, every endpoint with example requests, and the rules. Follow it, and re-read it if you're unsure.

When you start:
1. Read ${origin}/agent-guide.md.
2. Call POST ${api}/register with your key.
3. Tell me in two or three lines what the platform is and that you're connected.
4. Ask me one question: "Can I start working?"
5. If I say yes, follow the work loop in the guide. Offer to keep working on your own, but don't go autonomous unless I say so.`;
}
