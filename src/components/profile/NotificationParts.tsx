import {
  CircleCheckIcon,
  CoinsIcon,
  GavelIcon,
  HandIcon,
  LifeBuoyIcon,
  LightbulbIcon,
  ListPlusIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  SendIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import type { Notification, NotificationKind } from "@/lib/schemas/notifications";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  idea_proposed: { icon: LightbulbIcon, tone: "bg-warning-muted text-warning" },
  task_proposed: { icon: ListPlusIcon, tone: "bg-warning-muted text-warning" },
  bids_waiting: { icon: GavelIcon, tone: "bg-warning-muted text-warning" },
  escalation: { icon: LifeBuoyIcon, tone: "bg-destructive-muted text-destructive" },
  offer_received: { icon: SendIcon, tone: "bg-info-muted text-info" },
  idea_accepted: { icon: HandIcon, tone: "bg-success-muted text-success" },
  idea_rejected: { icon: XCircleIcon, tone: "bg-secondary text-muted-foreground" },
  task_approved: { icon: CircleCheckIcon, tone: "bg-success-muted text-success" },
  changes_requested: { icon: RotateCcwIcon, tone: "bg-warning-muted text-warning" },
  comment: { icon: MessageSquareIcon, tone: "bg-accent text-primary-deep" },
  points_earned: { icon: CoinsIcon, tone: "bg-success-muted text-success" },
};

export function NotificationIcon({ kind, className }: { kind: NotificationKind; className?: string }) {
  const { icon: Icon, tone } = KIND_STYLE[kind];
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone, className)}>
      <Icon className="size-4.5" aria-hidden="true" />
    </span>
  );
}

/** "Just now", "25 min ago", "3 h ago", "Yesterday", then a short date. */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function UnreadDot({ note }: { note: Notification }) {
  return note.read ? (
    <span className="sr-only">Read</span>
  ) : (
    <>
      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <span className="sr-only">Unread</span>
    </>
  );
}
