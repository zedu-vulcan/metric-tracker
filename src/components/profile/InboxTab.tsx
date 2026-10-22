"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCheckIcon, ChevronRightIcon, CircleCheckIcon, InboxIcon, RotateCwIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/lib/schemas/notifications";
import { cn } from "@/lib/utils";
import { NotificationIcon, UnreadDot, timeAgo } from "./NotificationParts";
import { useNotifications } from "./useNotifications";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "needs", label: "Awaiting You" },
  { id: "unread", label: "Unread" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today", "Yesterday", "Earlier this week", then "Older". */
function dayGroup(iso: string, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const at = new Date(iso).getTime();
  if (at >= startOfToday) return "Today";
  if (at >= startOfToday - DAY_MS) return "Yesterday";
  if (at >= startOfToday - 6 * DAY_MS) return "Earlier this week";
  return "Older";
}

function groupByDay(notes: Notification[]) {
  const groups = new Map<string, Notification[]>();
  for (const note of notes) {
    const label = dayGroup(note.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), note]);
  }
  return [...groups.entries()];
}

export function InboxRow({ note, href, onOpen }: { note: Notification; href: string; onOpen: () => void }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onOpen}
        className="group/row flex items-start gap-3 rounded-2xl px-3 py-3 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <NotificationIcon kind={note.kind} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <UnreadDot note={note} />
            <span className={cn("truncate text-sm", note.read ? "font-medium text-muted-foreground" : "font-bold text-foreground")}>
              {note.title}
            </span>
          </span>
          <span className={cn("text-[13px] leading-snug", note.read ? "text-muted-foreground" : "text-foreground/80")}>
            {note.message}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-muted-foreground">
          {timeAgo(note.createdAt)}
          <ChevronRightIcon
            className="size-4 transition-transform pointer-fine:opacity-0 pointer-fine:group-hover/row:translate-x-0.5 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-visible/row:opacity-100"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

const groupHeading = "m-0 px-3 text-2xs font-bold uppercase tracking-[0.07em] text-muted-foreground";

export function InboxTab() {
  const { href } = useProject();
  const { notifications, unreadCount, loading, failed, markRead, markAllRead, reload } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const needsYou = notifications.filter((note) => note.needsAction);
  const counts: Record<Filter, number> = {
    all: notifications.length,
    needs: needsYou.length,
    unread: unreadCount,
  };
  const visible = filter === "needs" ? needsYou : filter === "unread" ? notifications.filter((note) => !note.read) : notifications;
  // On "All", what's waiting on you gets its own panel above the timeline.
  const pinned = filter === "all" ? needsYou : [];
  const timeline = filter === "all" ? visible.filter((note) => !note.needsAction) : visible;

  const row = (note: Notification) => (
    <InboxRow key={note.id} note={note} href={href(note.href)} onOpen={() => !note.read && void markRead(note.id)} />
  );

  const emptyCopy: Record<Filter, { title: string; body: string }> = {
    all: {
      title: "Nothing here yet",
      body: "Bids on tasks you posted, offers to your agents and the points they earn will show up here.",
    },
    needs: { title: "Nothing waiting on you", body: "Bids and questions on tasks you posted, and offers to your agents, land here." },
    unread: { title: "You're all caught up", body: "Everything in your inbox has been read." },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inbox</CardTitle>
        <CardDescription>
          {loading
            ? "Checking for updates…"
            : `${unreadCount > 0 ? `${unreadCount} unread` : "Everything is read"} · decisions waiting on you and news about your agents`}
        </CardDescription>
        {notifications.length > 0 && (
          <CardAction>
            <Button variant="outline" size="sm" disabled={unreadCount === 0} onClick={() => void markAllRead()}>
              <CheckCheckIcon data-icon="inline-start" aria-hidden="true" />
              Mark all as read
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === id
                  ? "border-primary bg-accent text-primary-deep"
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
              )}
            >
              {label}
              {!loading && <span className="tabular-nums opacity-70">{counts[id]}</span>}
            </button>
          ))}
        </div>

        {failed && (
          <Alert variant="destructive" className="flex items-center justify-between gap-3">
            <AlertDescription>Couldn&apos;t load your inbox.</AlertDescription>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RotateCwIcon data-icon="inline-start" aria-hidden="true" />
              Try again
            </Button>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-start gap-3 px-3 py-3">
                <Skeleton className="size-9 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
                {filter === "all" ? <InboxIcon aria-hidden="true" /> : <CircleCheckIcon aria-hidden="true" />}
              </EmptyMedia>
              <EmptyTitle className="text-[15px] font-bold">{emptyCopy[filter].title}</EmptyTitle>
              <EmptyDescription>{emptyCopy[filter].body}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {pinned.length > 0 && (
              <section aria-labelledby="inbox-waiting" className="flex flex-col gap-1 rounded-2xl bg-warning-muted/60 p-2">
                <h3 id="inbox-waiting" className="m-0 flex items-center justify-between gap-2 px-3 pt-2 pb-1 text-sm font-bold text-foreground">
                  Waiting on you
                  <span className="text-xs font-semibold text-warning tabular-nums">{pinned.length}</span>
                </h3>
                <ul className="m-0 flex list-none flex-col p-0">{pinned.map(row)}</ul>
              </section>
            )}

            {groupByDay(timeline).map(([label, notes]) => (
              <section key={label} aria-label={label} className="flex flex-col gap-1">
                <h3 className={groupHeading}>{label}</h3>
                <ul className="m-0 flex list-none flex-col p-0">{notes.map(row)}</ul>
              </section>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
