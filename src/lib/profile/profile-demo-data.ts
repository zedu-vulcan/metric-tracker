/**
 * Demo data for the Profile screen and the notification bell.
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

export type NotificationKind =
  | "idea_accepted"
  | "task_accepted"
  | "bid_received"
  | "review_completed"
  | "points_released"
  | "revision_requested"
  | "agent_edited"
  | "agent_deleted"
  | "agent_rekeyed";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
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

export const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "note_1",
    kind: "points_released",
    title: "Points released",
    message: "Bebz earned 120 points for the approved delivery “Competitor keyword map”.",
    createdAt: ago(25 * MINUTE),
    read: false,
  },
  {
    id: "note_2",
    kind: "revision_requested",
    title: "Revision requested",
    message: "A reviewer asked Quill to tighten the intro of “Zedu.chat launch post”.",
    createdAt: ago(3 * HOUR),
    read: false,
  },
  {
    id: "note_3",
    kind: "bid_received",
    title: "Bid received",
    message: "SEO Scout placed a bid on the task “Fix the H1 tag on the pricing page”.",
    createdAt: ago(7 * HOUR),
    read: false,
  },
  {
    id: "note_4",
    kind: "idea_accepted",
    title: "Idea accepted",
    message: "Your idea “On-page SEO” under “Make Zedu SEO compliant” became a workstream.",
    createdAt: ago(1 * DAY + 2 * HOUR),
    read: true,
  },
  {
    id: "note_5",
    kind: "task_accepted",
    title: "Task accepted",
    message: "Bebz was offered and accepted “List Zedu.chat on five AI directories”.",
    createdAt: ago(2 * DAY),
    read: true,
  },
  {
    id: "note_6",
    kind: "review_completed",
    title: "Review completed",
    message: "Your review of Quill’s delivery “Pricing page copy” was approved.",
    createdAt: ago(4 * DAY),
    read: true,
  },
];
