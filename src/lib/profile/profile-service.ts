/**
 * Profile service for the agent dialogs. Inbox notifications are real: see `/api/notifications`.
 * Today they work on in-memory demo data (a page refresh resets it). When the backend exists,
 * replace each function body with the API call below. Keep the signatures and the UI stays untouched.
 *
 * Errors: every function throws `ProfileServiceError` with `code` "not_found" (HTTP 404) or
 * "validation" (HTTP 400 { error: "Validation failed", details: { field: [message] } }). 401 comes from auth.
 *
 * Function                          → Future API call
 * ------------------------------------------------------------------------------------------------
 * getProfile()                      → GET    /api/profile
 *                                     response 200: { id, name, email, avatarUrl }
 * listAgents()                      → GET    /api/profile/agents
 *                                     response 200: [{ id, name, speciality, keyHint, createdAt }]
 *                                     (never returns a full key, only keyHint)
 * updateAgent(id, input)            → PATCH  /api/profile/agents/:id
 *                                     request:  { name, speciality }
 *                                     response 200: the updated agent. 400 when invalid, 404 when missing.
 * deleteAgent(id)                   → DELETE /api/profile/agents/:id
 *                                     response 204, no body. 404 when missing.
 * generateAgentKey(id)              → POST   /api/profile/agents/:id/key
 *                                     request:  none
 *                                     response 201: { agent: <updated agent>, key } where `key` is the full new key,
 *                                     returned ONCE. The old key stops working immediately. 404 when missing.
 *
 * Open backend questions:
 * - Validation limits below (name 2–40, specialisation 2–80 characters) are a proposal.
 */

import {
  DEMO_AGENTS,
  DEMO_PROFILE,
  type Agent,
  type UserProfile,
} from "./profile-demo-data";

export type { Agent, UserProfile };

export type AgentInput = { name: string; speciality: string };
export type AgentInputErrors = Partial<Record<keyof AgentInput, string>>;

export class ProfileServiceError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "validation"
  ) {
    super(message);
    this.name = "ProfileServiceError";
  }
}

/** The same rules the backend should enforce, so the form shows matching messages. */
export function validateAgentInput(input: AgentInput): AgentInputErrors {
  const errors: AgentInputErrors = {};
  const name = input.name.trim();
  const speciality = input.speciality.trim();
  if (!name) errors.name = "Give your agent a name.";
  else if (name.length < 2) errors.name = "The name needs at least 2 characters.";
  else if (name.length > 40) errors.name = "Keep the name under 40 characters.";
  if (!speciality) errors.speciality = "Say what this agent specialises in.";
  else if (speciality.length < 2) errors.speciality = "The specialisation needs at least 2 characters.";
  else if (speciality.length > 80) errors.speciality = "Keep the specialisation under 80 characters.";
  return errors;
}

// ── In-memory demo store (remove when the API replaces the functions below) ──

const store = {
  profile: { ...DEMO_PROFILE },
  agents: DEMO_AGENTS.map((agent) => ({ ...agent })),
};

function findAgent(id: string) {
  const agent = store.agents.find((item) => item.id === id);
  if (!agent) throw new ProfileServiceError("Not found", "not_found");
  return agent;
}

function newDemoKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `zedu_ak_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// ── Profile ──

export async function getProfile(): Promise<UserProfile> {
  return { ...store.profile };
}

// ── Agents ──

export async function listAgents(): Promise<Agent[]> {
  return store.agents.map((agent) => ({ ...agent }));
}

export async function updateAgent(id: string, input: AgentInput): Promise<Agent> {
  if (Object.keys(validateAgentInput(input)).length > 0) {
    throw new ProfileServiceError("Validation failed", "validation");
  }
  const agent = findAgent(id);
  agent.name = input.name.trim();
  agent.speciality = input.speciality.trim();
  return { ...agent };
}

export async function deleteAgent(id: string): Promise<void> {
  findAgent(id);
  store.agents = store.agents.filter((item) => item.id !== id);
}

export async function generateAgentKey(id: string): Promise<{ agent: Agent; key: string }> {
  const agent = findAgent(id);
  const key = newDemoKey();
  agent.keyHint = `zedu_ak_…${key.slice(-4)}`;
  return { agent: { ...agent }, key };
}
