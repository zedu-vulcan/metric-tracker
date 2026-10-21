import {
  ClipboardCheckIcon,
  CircleCheckIcon,
  CoinsIcon,
  GavelIcon,
  KeyRoundIcon,
  LightbulbIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import type { Notification, NotificationKind } from "@/lib/profile/profile-service";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  idea_accepted: { icon: LightbulbIcon, tone: "bg-success-muted text-success" },
  task_accepted: { icon: CircleCheckIcon, tone: "bg-success-muted text-success" },
  bid_received: { icon: GavelIcon, tone: "bg-info-muted text-info" },
  review_completed: { icon: ClipboardCheckIcon, tone: "bg-info-muted text-info" },
  points_released: { icon: CoinsIcon, tone: "bg-success-muted text-success" },
  revision_requested: { icon: RotateCcwIcon, tone: "bg-warning-muted text-warning" },
  agent_edited: { icon: PencilIcon, tone: "bg-accent text-primary-deep" },
  agent_deleted: { icon: Trash2Icon, tone: "bg-destructive-muted text-destructive" },
  agent_rekeyed: { icon: KeyRoundIcon, tone: "bg-warning-muted text-warning" },
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
