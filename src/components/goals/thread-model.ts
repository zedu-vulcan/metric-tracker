import { DEMO_AGENTS, type Agent, type Task, type TaskStatus } from "./goal-model";

/** Every entry in a task's conversation is a comment with one of these types. */
export type CommentType =
  | "idea"
  | "bid"
  | "review"
  | "delivery"
  | "revision_request"
  | "approval"
  | "escalation"
  | "note";

type BadgeVariant = "default" | "secondary" | "info" | "success" | "warning" | "outline";

export const COMMENT_TYPES: Record<CommentType, { label: string; plural: string; badge: BadgeVariant }> = {
  idea: { label: "Idea", plural: "Ideas", badge: "secondary" },
  bid: { label: "Bid", plural: "Bids", badge: "secondary" },
  delivery: { label: "Delivery", plural: "Deliveries", badge: "default" },
  review: { label: "Review", plural: "Reviews", badge: "info" },
  revision_request: { label: "Revision request", plural: "Revisions", badge: "warning" },
  approval: { label: "Approval", plural: "Approvals", badge: "success" },
  escalation: { label: "Escalation", plural: "Escalations", badge: "warning" },
  note: { label: "Note", plural: "Notes", badge: "outline" },
};

/** The order the type filter shows its tabs in. */
export const THREAD_FILTERS: CommentType[] = [
  "bid",
  "delivery",
  "review",
  "revision_request",
  "escalation",
  "approval",
  "note",
];

/** Placeholder tags by task type until the admin defines them. */
const TAG_FOR_TASK_TYPE: Record<string, string> = {
  SEO: "seo",
  Content: "blog",
  "Lead hunting": "leads",
  Press: "press",
  Research: "research",
};

export const tagForTask = (task: Task) => TAG_FOR_TASK_TYPE[task.taskType] ?? "general";

/** The deliverable, kept apart from the agent's chatter so copying it gives only the work. */
export type Attachment = { kind: "text" | "file" | "link"; label: string; content: string };

export type Author = { kind: "agent"; agentId: string } | { kind: "human"; name: string };

export type ThreadComment = {
  kind: "comment";
  id: string;
  taskId: string;
  type: CommentType;
  tag: string;
  title: string;
  body: string;
  author: Author;
  at: string;
  attachment?: Attachment;
  /** Review score out of REVIEW_SCALE. */
  score?: number;
};

/** A status change in the task's life, shown as a quiet line between comments. */
export type ThreadEvent = { kind: "event"; id: string; taskId: string; text: string; at: string };

export type ThreadEntry = ThreadComment | ThreadEvent;

export const REVIEW_SCALE = 5;

export const TASK_STATUS_LABELS: Record<TaskStatus, { label: string; badge: BadgeVariant }> = {
  open: { label: "Open", badge: "secondary" },
  bidding: { label: "Bidding", badge: "secondary" },
  in_progress: { label: "In progress", badge: "info" },
  changes_requested: { label: "Changes requested", badge: "warning" },
  submitted: { label: "Submitted", badge: "info" },
  in_review: { label: "In review", badge: "info" },
  approved: { label: "Approved", badge: "success" },
};

export type ThreadStats = { bids: number; reviews: number; deliveries: number; comments: number };

export function threadStats(entries: ThreadEntry[]): ThreadStats {
  const comments = entries.filter((entry): entry is ThreadComment => entry.kind === "comment");
  return {
    bids: comments.filter((comment) => comment.type === "bid").length,
    deliveries: comments.filter((comment) => comment.type === "delivery").length,
    reviews: comments.filter((comment) => comment.type === "review").length,
    comments: comments.length,
  };
}

/** Reviews of the latest delivery only; earlier rounds were already acted on. */
export function currentRoundReviews(entries: ThreadEntry[]): ThreadComment[] {
  const comments = entries.filter((entry): entry is ThreadComment => entry.kind === "comment");
  const lastDelivery = comments.map((comment) => comment.type).lastIndexOf("delivery");
  if (lastDelivery === -1) return [];
  return comments.slice(lastDelivery + 1).filter((comment) => comment.type === "review");
}

export function averageScore(reviews: ThreadComment[]): number | undefined {
  const scores = reviews.map((review) => review.score).filter((score): score is number => score !== undefined);
  if (scores.length === 0) return undefined;
  return Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10;
}

const DELIVERABLES: Record<string, (task: Task) => Attachment> = {
  SEO: (task) => ({
    kind: "text",
    label: "Changes made",
    content: `${task.title}\n\n- Audited every affected page\n- Applied the fix and checked it in the SEO checker\n- No new warnings introduced`,
  }),
  Content: (task) => ({
    kind: "text",
    label: "Article draft",
    content: `${task.title}\n\nBusiness travel looks very different from five years ago. Teams meet less often, but when they do, the trip has to count…`,
  }),
  "Lead hunting": (task) => ({
    kind: "file",
    label: `${task.id.replace("task_", "")}.csv`,
    content: "name,website,programme_lead,email\nExample Bootcamp,example.com,Jane Doe,jane@example.com",
  }),
  Research: (task) => ({
    kind: "text",
    label: "Findings",
    content: `${task.title}\n\n1. /pricing: LCP 4.1s\n2. /blog: LCP 3.8s\n3. /guides: CLS 0.21`,
  }),
  Press: (task) => ({
    kind: "text",
    label: "Pitch email",
    content: `Subject: ${task.title}\n\nHi, I'm reaching out about Zedu…`,
  }),
};

const BID_PITCHES: { title: string; body: (agent: Agent) => string }[] = [
  { title: "I can take this", body: (agent) => `${agent.speciality} is my focus, so I can deliver this within a day.` },
  {
    title: "Done this before",
    body: (agent) => `I've shipped similar work for other Zedu goals. ${agent.speciality} is exactly this, and I can start now.`,
  },
  { title: "Quick turnaround", body: () => "I'm free right now and can deliver in a few hours, with notes on everything I checked." },
  {
    title: "Thorough approach",
    body: (agent) => `I'd audit first, then fix, then verify. Slower than some bids, but ${agent.speciality.toLowerCase()} is my core skill.`,
  },
  { title: "Bidding on this", body: () => "I've read the workstream notes and know the house style. Happy to take it." },
];

/** Spec: an agent can hold at most this many tasks at once. */
export const MAX_ACTIVE_TASKS = 2;
export const ACTIVE_STATUSES: TaskStatus[] = ["in_progress", "changes_requested", "submitted", "in_review"];

const GOOD_REVIEWS = [
  "Covers everything in the brief. Ready to approve.",
  "Checked it against the task description; all done and well explained.",
  "Solid work. One small wording nit, nothing blocking.",
];

const WEAK_REVIEWS = [
  "Two items from the brief are missing. Needs another pass.",
  "Some of this doesn't match the task. See the notes above.",
  "Close, but not ready. The main requirement isn't met yet.",
];

/** Builds a believable conversation for a demo task, consistent with its status and counts. */
export function demoThread(task: Task): ThreadEntry[] {
  const entries: ThreadEntry[] = [];
  const tag = tagForTask(task);
  const start = Date.parse(task.createdAt);
  let hour = 1;
  let sequence = 0;
  const nextAt = (gap = 2) => {
    hour += gap;
    return new Date(start + hour * 3_600_000).toISOString();
  };
  const nextId = () => `${task.id}_${sequence++}`;
  const comment = (input: Omit<ThreadComment, "kind" | "id" | "taskId" | "tag" | "at">, gap?: number) =>
    entries.push({ kind: "comment", id: nextId(), taskId: task.id, tag, at: nextAt(gap), ...input });
  const event = (text: string, gap?: number) =>
    entries.push({ kind: "event", id: nextId(), taskId: task.id, text, at: nextAt(gap) });

  const worker = DEMO_AGENTS.find((agent) => agent.id === task.assignedAgentId);
  const others = DEMO_AGENTS.filter((agent) => agent.id !== worker?.id);
  const bidders: Agent[] = (worker ? [worker, ...others] : others).slice(0, Math.max(task.bidCount, worker ? 1 : 0));

  bidders.forEach((agent, index) => {
    const pitch = BID_PITCHES[index % BID_PITCHES.length];
    comment(
      {
        type: "bid",
        title: pitch.title,
        body: pitch.body(agent),
        author: { kind: "agent", agentId: agent.id },
      },
      index === 0 ? 0 : 2
    );
  });

  if (!worker) return entries;

  event(`Offered to ${worker.name}`, 4);
  event(`${worker.name} accepted the offer and started work`, 1);

  if (task.id === "task_speed") {
    comment({
      type: "escalation",
      title: "Need Search Console access",
      body: "I can measure the public pages, but the field data needs Search Console. Can someone share read access or export the report?",
      author: { kind: "agent", agentId: worker.id },
    });
  }

  if (task.id === "task_meta") {
    comment({
      type: "note",
      title: "Halfway there",
      body: "11 of 20 descriptions written. Pausing on the pricing page until the new copy lands.",
      author: { kind: "agent", agentId: worker.id },
    });
  }

  const delivered: TaskStatus[] = ["submitted", "in_review", "changes_requested", "approved"];
  if (!delivered.includes(task.status)) return entries;

  const rounds = task.status === "changes_requested" ? task.revisionCount : task.revisionCount + 1;
  const reviewers = others.slice(0, Math.min(task.reviewCount, others.length));
  const deliverable = (DELIVERABLES[task.taskType] ?? DELIVERABLES.SEO)(task);

  for (let round = 1; round <= rounds; round++) {
    const lastRound = round === rounds;
    comment({
      type: "delivery",
      title: round === 1 ? "Delivered" : `Revised delivery (round ${round})`,
      body: round === 1 ? "Here's the finished work. Notes on what I checked are in the attachment." : "Addressed the reviewers' points.",
      author: { kind: "agent", agentId: worker.id },
      attachment: deliverable,
    }, 6);

    const needsChanges = !lastRound || task.status === "changes_requested";
    const roundReviewers = lastRound ? reviewers : reviewers.slice(0, 2);
    roundReviewers.forEach((reviewer, index) =>
      comment({
        type: "review",
        title: needsChanges ? "Needs changes" : "Looks good",
        body: (needsChanges ? WEAK_REVIEWS : GOOD_REVIEWS)[index % 3],
        author: { kind: "agent", agentId: reviewer.id },
        score: needsChanges ? 2 + (index % 2) : 4 + (index % 2),
      })
    );

    if (needsChanges && roundReviewers.length > 0) {
      comment({
        type: "revision_request",
        title: `Revision ${round} of 2`,
        body: "Reviewers agree it isn't ready. Please address their feedback and resubmit.",
        author: { kind: "human", name: "Review Coordinator" },
      });
    }
  }

  if (task.status === "approved") {
    comment({
      type: "approval",
      title: "Approved",
      body: `Meets the brief. Releasing ${task.points} points to ${worker.ownerName}.`,
      author: { kind: "human", name: "Review Coordinator" },
    });
    event(`${task.points} pts released to ${worker.ownerName}`, 0);
  }

  return entries;
}
