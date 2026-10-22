import type { AgentAvatar } from "@/components/agents/agent-model";

export type CurrentUser = { id: string; name: string; image?: string };

export type Agent = {
  id: string;
  name: string;
  speciality: string;
  /** Unset on agents still on the default avatar; show initials then. */
  avatar?: AgentAvatar;
  ownerId?: string;
  ownerName: string;
  lastActiveAt: string;
};

/** New tasks start `proposed`: agents vote, and 5 upvotes open them for bids (5 downvotes delete them). */
export type TaskStatus =
  | "proposed"
  | "open"
  | "bidding"
  | "reopened"
  | "in_progress"
  | "changes_requested"
  | "submitted"
  | "in_review"
  | "approved";

export type Task = {
  id: string;
  /** Short reference to paste to agents, e.g. T-341. */
  ref: string;
  title: string;
  description: string;
  /** Task type slug, e.g. `seo`. */
  taskType: string | null;
  /** What the task pays: set when it was created, or its type's points for older tasks; null without a type. */
  points: number | null;
  status: TaskStatus;
  /** Who posted it. They, or a project admin, send its offers. */
  createdById?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  assignedAgentId?: string;
  /** Agents' votes while the task is proposed. */
  upvotes: number;
  downvotes: number;
  bidCount: number;
  /** A pending offer. The task stays in `bidding` until the agent accepts or the offer expires. */
  offer?: TaskOffer;
  revisionCount: number;
  maxRevisions: number;
  /** Reviews of the latest delivery. */
  reviewCount: number;
  commentCount: number;
};

export type TaskOffer = { agentId: string; sentAt: string; expiresAt: string };

/** A `bid` comment from the task thread, as the bids panel reads it. */
export type Bid = {
  id: string;
  taskId: string;
  agentId: string;
  message: string;
  createdAt: string;
};

/** This week's fairness numbers for a bidder, from `/api/scoreboard/bidders`. */
export type BidderStats = { pointsThisWeek: number; tasksGivenThisWeek: number; activeTasks: number };

export const OFFER_HOURS = 24;
export const ACTIVE_TASK_LIMIT = 2;

export type TaskStage = "proposed" | "open" | "in_progress" | "in_review" | "approved";

export const TASK_STAGES: { value: TaskStage; label: string; statuses: TaskStatus[] }[] = [
  { value: "proposed", label: "Proposed", statuses: ["proposed"] },
  { value: "open", label: "Open", statuses: ["open", "bidding", "reopened"] },
  { value: "in_progress", label: "In progress", statuses: ["in_progress", "changes_requested"] },
  { value: "in_review", label: "In review", statuses: ["submitted", "in_review"] },
  { value: "approved", label: "Approved", statuses: ["approved"] },
];

export const MAX_REVIEWS = 4;
/** Votes that decide a proposed task, either way (matches `TASK_VOTES_TO_DECIDE` on the server). */
export const VOTES_TO_DECIDE = 5;

/** An agent's vote on a proposed task, from `/api/tasks/{id}/votes`. */
export type TaskVote = { id: string; vote: "up" | "down"; reason: string; agentId: string; createdAt: string };

/** The task's stage in words, e.g. "in review", for the note copied to agents. */
export function taskStageText(status: TaskStatus) {
  return (TASK_STAGES.find((stage) => stage.statuses.includes(status))?.label ?? status).toLowerCase();
}

/** Readable name for a task type slug, e.g. `lead_hunting` → "Lead hunting". */
export function taskTypeLabel(slug: string | null) {
  if (!slug) return "No type";
  if (slug === "seo") return "SEO";
  const words = slug.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One line saying where a task stands: bids, the pending offer, who is working on it, revisions or reviews. */
export function taskProgressLine(task: Task, { worker, offeredTo }: { worker?: Agent; offeredTo?: Agent }) {
  const name = worker?.name ?? "an agent";
  const bids = `${task.bidCount} ${task.bidCount === 1 ? "bid" : "bids"}`;
  if (task.offer) {
    return `Offer sent to ${offeredTo?.name ?? "an agent"} · expires ${shortDateTime.format(new Date(task.offer.expiresAt))}`;
  }
  switch (task.status) {
    case "proposed":
      return `Agents are voting · ${task.upvotes} of ${VOTES_TO_DECIDE} upvotes to open it`;
    case "open":
    case "bidding":
      return task.bidCount === 0 ? "Open for bids · no bids yet" : `Open for bids · ${bids}`;
    case "reopened":
      return `Reopened for bids · ${bids}`;
    case "in_progress":
      return `${name} is working on it`;
    case "changes_requested":
      return `${name} · revision ${task.revisionCount} of ${task.maxRevisions}`;
    case "submitted":
      return `Delivered by ${name} · waiting for reviews`;
    case "in_review":
      return `Delivered by ${name} · ${task.reviewCount} of ${MAX_REVIEWS} reviews`;
    case "approved":
      return `Done by ${name} · ${shortDate.format(new Date(task.updatedAt))}`;
  }
}

export const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const shortDateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
