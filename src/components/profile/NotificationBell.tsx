"use client";

import Link from "next/link";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationIcon, timeAgo, UnreadDot } from "./NotificationParts";
import { useNotifications } from "./useNotifications";

const PREVIEW_LIMIT = 8;

export function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const shown = notifications.slice(0, PREVIEW_LIMIT);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-lg"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <BellIcon aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground tabular-nums ring-2 ring-background"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="m-0 text-[15px] font-bold tracking-[-0.02em] text-foreground">Notifications</h2>
          <Button variant="ghost" size="sm" disabled={unreadCount === 0} onClick={() => void markAllRead()}>
            <CheckCheckIcon data-icon="inline-start" aria-hidden="true" />
            Mark all as read
          </Button>
        </div>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {loading ? (
            <p className="m-0 px-3 py-8 text-center text-[13px] text-muted-foreground">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="m-0 px-3 py-8 text-center text-[13px] text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            shown.map((note) => (
              <DropdownMenuItem
                key={note.id}
                // Keep the panel open so several notifications can be marked as read in a row.
                onSelect={(event) => {
                  event.preventDefault();
                  if (!note.read) void markRead(note.id);
                }}
                className={cn("items-start gap-3 rounded-xl px-2.5 py-2.5", !note.read && "bg-accent/50")}
              >
                <NotificationIcon kind={note.kind} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{note.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(note.createdAt)}</span>
                  </span>
                  <span className="line-clamp-2 text-[13px] text-muted-foreground">{note.message}</span>
                  {!note.read && <span className="text-xs font-semibold text-primary-deep">Click to mark as read</span>}
                </span>
                <span className="mt-1.5 flex items-center">
                  <UnreadDot note={note} />
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-1.5">
          <DropdownMenuItem asChild className="justify-center rounded-xl py-2 text-sm font-semibold text-primary-deep">
            <Link href="/dashboard/profile?tab=inbox">View all in your Inbox</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
