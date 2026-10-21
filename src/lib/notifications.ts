import { REASON_LABELS, isPointReason } from "@/lib/points";
import type { Notification } from "@/lib/schemas/notifications";

/** How far back updates reach. Items waiting on you stay until they're dealt with. */
export const NOTIFICATION_WINDOW_DAYS = 30;
export const NOTIFICATION_LIMIT = 60;

type TaskRef = { id: string; title: string; goalId: string | null; workstreamId: string | null };

/** The raw rows the inbox is built from, already scoped to one person in one project. */
export type NotificationFeed = {
  proposedIdeas: { id: string; title: string; goalId: string; goalTitle: string; agentName: string | null; upvotes: number; createdAt: Date }[];
  proposedTasks: { task: TaskRef; workstreamTitle: string | null; createdAt: Date }[];
  biddingTasks: { task: TaskRef; bidCount: number; lastBidAt: Date }[];
  escalations: { id: string; task: TaskRef; authorName: string; body: string; createdAt: Date }[];
  offers: { task: TaskRef; agentName: string; offeredAt: Date }[];
  decidedIdeas: { id: string; title: string; goalId: string; status: "accepted" | "rejected"; agentName: string; reason: string | null; updatedAt: Date }[];
  decidedTasks: { task: TaskRef; status: "approved" | "changes_requested"; agentName: string; revisionCount: number; updatedAt: Date }[];
  comments: { id: string; task: TaskRef; type: "note" | "review"; isReply: boolean; authorName: string; agentName: string; body: string; verdict: "approve" | "changes" | null; score: number | null; createdAt: Date }[];
  points: { id: string; amount: number; reason: string; note: string | null; agentName: string | null; createdAt: Date }[];
};

type Item = Omit<Notification, "read" | "createdAt"> & { createdAt: Date };

const excerpt = (text: string, max = 120) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const formatPoints = (amount: number) => {
  const size = Math.abs(amount);
  return `${Number.isInteger(size) ? size : size.toFixed(1)} point${size === 1 ? "" : "s"}`;
};

export function taskHref(task: TaskRef) {
  if (!task.goalId) return "/goals";
  if (!task.workstreamId) return `/goals/${task.goalId}`;
  return `/goals/${task.goalId}/workstreams/${task.workstreamId}/tasks/${task.id}`;
}

/**
 * Turns the feed into inbox items, newest first. Each item's id is a stable key that changes when
 * the thing it describes changes (a new bid, a new offer, another revision), so it shows as unread again.
 */
export function buildNotifications(feed: NotificationFeed, readKeys: ReadonlySet<string>, limit = NOTIFICATION_LIMIT): Notification[] {
  const items: Item[] = [];

  for (const idea of feed.proposedIdeas) {
    const backing = idea.upvotes > 0 ? ` · ${plural(idea.upvotes, "upvote")}` : "";
    items.push({
      id: `idea:${idea.id}`,
      kind: "idea_proposed",
      title: "New idea to review",
      message: `${idea.agentName ?? "Someone"} suggested “${idea.title}” for “${idea.goalTitle}”${backing}.`,
      href: `/goals/${idea.goalId}`,
      needsAction: true,
      createdAt: idea.createdAt,
    });
  }

  for (const { task, workstreamTitle, createdAt } of feed.proposedTasks) {
    items.push({
      id: `task-proposed:${task.id}`,
      kind: "task_proposed",
      title: "New task to review",
      message: workstreamTitle
        ? `“${task.title}” was suggested under “${workstreamTitle}”. Accept it to open it for bids.`
        : `“${task.title}” was suggested. Accept it to open it for bids.`,
      href: taskHref(task),
      needsAction: true,
      createdAt,
    });
  }

  for (const { task, bidCount, lastBidAt } of feed.biddingTasks) {
    items.push({
      id: `bids:${task.id}:${bidCount}`,
      kind: "bids_waiting",
      title: "Bids waiting",
      message: `${plural(bidCount, "bid")} on “${task.title}”. Pick an agent to offer it to.`,
      href: taskHref(task),
      needsAction: true,
      createdAt: lastBidAt,
    });
  }

  for (const escalation of feed.escalations) {
    items.push({
      id: `comment:${escalation.id}`,
      kind: "escalation",
      title: "An agent needs your help",
      message: `${escalation.authorName} on “${escalation.task.title}”: ${excerpt(escalation.body)}`,
      href: taskHref(escalation.task),
      needsAction: true,
      createdAt: escalation.createdAt,
    });
  }

  for (const { task, agentName, offeredAt } of feed.offers) {
    items.push({
      id: `offer:${task.id}:${offeredAt.getTime()}`,
      kind: "offer_received",
      title: `${agentName} was offered a task`,
      message: `“${task.title}”. ${agentName} needs to accept it before the offer runs out.`,
      href: taskHref(task),
      needsAction: false,
      createdAt: offeredAt,
    });
  }

  for (const idea of feed.decidedIdeas) {
    const accepted = idea.status === "accepted";
    items.push({
      id: `idea-${idea.status}:${idea.id}`,
      kind: accepted ? "idea_accepted" : "idea_rejected",
      title: accepted ? "Idea accepted" : "Idea turned down",
      message: accepted
        ? `${idea.agentName}'s idea “${idea.title}” is now a workstream.`
        : `${idea.agentName}'s idea “${idea.title}” wasn't taken up${idea.reason ? `: ${excerpt(idea.reason)}` : "."}`,
      href: `/goals/${idea.goalId}`,
      needsAction: false,
      createdAt: idea.updatedAt,
    });
  }

  for (const { task, status, agentName, revisionCount, updatedAt } of feed.decidedTasks) {
    const approved = status === "approved";
    items.push({
      id: `task-${status}:${task.id}:${revisionCount}`,
      kind: approved ? "task_approved" : "changes_requested",
      title: approved ? "Work approved" : "Changes requested",
      message: approved
        ? `${agentName}'s work on “${task.title}” was approved.`
        : `Reviewers asked ${agentName} to change “${task.title}”.`,
      href: taskHref(task),
      needsAction: false,
      createdAt: updatedAt,
    });
  }

  for (const comment of feed.comments) {
    const review = comment.type === "review";
    const verdict = comment.verdict === "approve" ? "approved" : comment.verdict === "changes" ? "asked for changes" : "reviewed it";
    const score = comment.score !== null ? ` (${comment.score}/10)` : "";
    items.push({
      id: `comment:${comment.id}`,
      kind: "comment",
      title: review ? `New review for ${comment.agentName}` : comment.isReply ? "New reply" : "New comment",
      message: review
        ? `${comment.authorName} ${verdict}${score} on “${comment.task.title}”.`
        : `${comment.authorName} on “${comment.task.title}”: ${excerpt(comment.body)}`,
      href: taskHref(comment.task),
      needsAction: false,
      createdAt: comment.createdAt,
    });
  }

  for (const entry of feed.points) {
    const label = isPointReason(entry.reason) ? REASON_LABELS[entry.reason] : entry.reason;
    const earned = entry.amount > 0;
    const who = entry.agentName ?? "You";
    items.push({
      id: `points:${entry.id}`,
      kind: "points_earned",
      title: `${earned ? "+" : "−"}${formatPoints(entry.amount)}`,
      message: earned
        ? `${who} earned ${formatPoints(entry.amount)}: ${label.toLowerCase()}.`
        : `${formatPoints(entry.amount)} taken off: ${entry.note ? excerpt(entry.note) : label.toLowerCase()}.`,
      href: "/profile?tab=agents",
      needsAction: false,
      createdAt: entry.createdAt,
    });
  }

  // Everything waiting on you is kept; updates fill the rest of the limit.
  const waiting = items.filter((item) => item.needsAction);
  const updates = items
    .filter((item) => !item.needsAction)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, Math.max(0, limit - waiting.length));

  return [...waiting, ...updates]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), read: readKeys.has(item.id) }));
}
