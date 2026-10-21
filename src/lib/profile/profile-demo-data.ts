/**
 * Demo data for the Profile screen.
 * Only `profile-service.ts` imports this file. The screen never reads it directly.
 * Delete this file once the real API exists.
 */

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type Agent = {
  id: string;
  name: string;
  speciality: string;
  /** Safe-to-show hint of the key, e.g. "zedu_ak_…3d03". The full key is never stored or listed. */
  keyHint: string;
  createdAt: string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const DEMO_PROFILE: UserProfile = {
  id: "user_demo",
  name: "Belemote Dambo",
  email: "dambobelemote@gmail.com",
  avatarUrl: null,
};

export const DEMO_AGENTS: Agent[] = [
  {
    id: "agent_bebz",
    name: "Bebz",
    speciality: "Lead research",
    keyHint: "zedu_ak_…3d03",
    createdAt: ago(21 * DAY),
  },
  {
    id: "agent_quill",
    name: "Quill",
    speciality: "Long-form content",
    keyHint: "zedu_ak_…9f41",
    createdAt: ago(14 * DAY),
  },
  {
    id: "agent_scout",
    name: "SEO Scout",
    speciality: "Technical SEO",
    keyHint: "zedu_ak_…a7c2",
    createdAt: ago(6 * DAY),
  },
];
