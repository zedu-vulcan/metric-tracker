import type { goalTypeValues } from "@/lib/schemas/goals";

export type GoalType = (typeof goalTypeValues)[number];

/** The goal types the API accepts, with their display labels. */
export const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "seo", label: "SEO" },
  { value: "content", label: "Content" },
  { value: "marketing", label: "Marketing" },
  { value: "research", label: "Research" },
  { value: "outreach", label: "Outreach" },
];

export function goalTypeLabel(type: string) {
  return GOAL_TYPES.find((option) => option.value === type)?.label ?? type;
}

export type DemoUser = { id: string; name: string; image?: string };

export type Goal = {
  id: string;
  title: string;
  type: GoalType;
  description: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  /** From the goals list, so cards don't need every goal's ideas loaded. */
  counts: GoalCounts;
};

export type GoalCounts = { pendingIdeas: number; workstreams: number; totalTasks: number; approvedTasks: number };

export type Agent = {
  id: string;
  name: string;
  speciality: string;
  ownerName: string;
  lastActiveAt: string;
};

export type IdeaStatus = "proposed" | "accepted" | "rejected";

/** An idea an agent proposed under a goal. Once accepted it is a workstream, and tasks are created inside it. */
export type Idea = {
  id: string;
  goalId: string;
  agentId: string;
  title: string;
  description: string;
  proposedAt: string;
  status: IdeaStatus;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
  /** Statuses of the workstream's tasks, from the goal detail, for progress summaries. */
  taskStatuses: TaskStatus[];
};

/** Tasks open for bidding as soon as they're created. `proposed` only remains on older records. */
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
  workstreamId: string;
  title: string;
  description: string;
  /** Task type slug, e.g. `seo`. */
  taskType: string | null;
  /** From the task type; null when the task has no type. */
  points: number | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  assignedAgentId?: string;
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

export type TaskStage = "open" | "in_progress" | "in_review" | "approved";

export const TASK_STAGES: { value: TaskStage; label: string; statuses: TaskStatus[] }[] = [
  { value: "open", label: "Open", statuses: ["proposed", "open", "bidding", "reopened"] },
  { value: "in_progress", label: "In progress", statuses: ["in_progress", "changes_requested"] },
  { value: "in_review", label: "In review", statuses: ["submitted", "in_review"] },
  { value: "approved", label: "Approved", statuses: ["approved"] },
];

export const MAX_REVIEWS = 4;

export type WorkstreamSummary = {
  openTasks: number;
  activeTasks: number;
  approvedTasks: number;
  totalTasks: number;
};

const inStage = (stage: TaskStage, status: TaskStatus) =>
  TASK_STAGES.find((option) => option.value === stage)?.statuses.includes(status) ?? false;

export function summarizeTasks(statuses: TaskStatus[]): WorkstreamSummary {
  return {
    openTasks: statuses.filter((status) => inStage("open", status)).length,
    activeTasks: statuses.filter((status) => inStage("in_progress", status) || inStage("in_review", status)).length,
    approvedTasks: statuses.filter((status) => status === "approved").length,
    totalTasks: statuses.length,
  };
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
