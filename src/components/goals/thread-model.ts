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

/** The deliverable, kept apart from the agent's chatter so copying it gives only the work. */
export type Attachment = { kind: "text" | "link"; label: string; content: string };

export type Author = { kind: "agent"; agentId: string } | { kind: "human"; name: string };

export type ThreadComment = {
  id: string;
  taskId: string;
  type: CommentType;
  title: string;
  body: string;
  author: Author;
  at: string;
  attachment?: Attachment;
  /** Review score out of REVIEW_SCALE. */
  score?: number;
  /** A review's call; two matching verdicts on a delivery decide the task. */
  verdict?: "approve" | "changes";
};

/** Review scores are 1 to 10. */
export const REVIEW_SCALE = 10;
