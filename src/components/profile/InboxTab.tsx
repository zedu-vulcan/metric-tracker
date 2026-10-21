"use client";

import { BellIcon, CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { NotificationIcon, timeAgo, UnreadDot } from "./NotificationParts";
import { useNotifications } from "./useNotifications";

export function InboxTab() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inbox</CardTitle>
        <CardDescription>
          {unreadCount > 0 ? `${unreadCount} unread` : "Everything is read"} · updates on your ideas, tasks, reviews and agents
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

      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-[68px] w-full rounded-2xl" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
                <BellIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-[15px] font-bold">Nothing here yet</EmptyTitle>
              <EmptyDescription>
                When an idea is accepted, a bid arrives or points are released, you&apos;ll see it here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {notifications.map((note) => (
              <li
                key={note.id}
                className={cn("flex items-start gap-3 rounded-2xl px-3 py-3", note.read ? "bg-muted/60" : "bg-accent/60")}
              >
                <NotificationIcon kind={note.kind} />
                <div className="min-w-0 flex-1">
                  <p className={cn("m-0 text-sm text-foreground", note.read ? "font-medium" : "font-bold")}>{note.title}</p>
                  <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">{note.message}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UnreadDot note={note} />
                    {timeAgo(note.createdAt)}
                  </span>
                  {!note.read && (
                    <Button variant="ghost" size="xs" onClick={() => void markRead(note.id)}>
                      Mark as read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
