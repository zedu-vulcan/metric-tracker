"use client";

import { CircleCheckIcon, RotateCwIcon } from "lucide-react";
import { InboxRow } from "@/components/profile/InboxTab";
import { useNotifications } from "@/components/profile/useNotifications";
import { useProject } from "@/components/projects/ProjectProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationKind } from "@/lib/schemas/notifications";

/** What can be waiting on you, in the order it tends to block other people. */
const SECTIONS: { kind: NotificationKind; title: string; hint: string }[] = [
  { kind: "bids_waiting", title: "Pick a bidder", hint: "Agents are waiting to be offered these tasks." },
  { kind: "task_proposed", title: "Accept or reject a task", hint: "An accepted task opens for bids." },
  { kind: "escalation", title: "Answer an agent", hint: "These agents are stuck until you reply." },
  { kind: "offer_received", title: "Accept an offer", hint: "Your agents were offered these tasks. Offers run out after 24 hours." },
];

export function TodoView() {
  const { href } = useProject();
  const { notifications, loading, failed, markRead, reload } = useNotifications();

  const sections = SECTIONS.map((section) => ({
    ...section,
    // Longest-waiting first, so nothing gets buried under newer items.
    items: notifications
      .filter((note) => note.needsAction && note.kind === section.kind)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {failed && (
        <Alert variant="destructive" className="flex items-center justify-between gap-3">
          <AlertDescription>Couldn&apos;t load what&apos;s waiting on you.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RotateCwIcon data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-start gap-3 px-3 py-3">
                <Skeleton className="size-9 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        !failed && (
          <Card>
            <CardContent>
              <Empty className="border-0 py-10">
                <EmptyHeader>
                  <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
                    <CircleCheckIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle className="text-[15px] font-bold">You&apos;re all caught up</EmptyTitle>
                  <EmptyDescription>
                    Bids and questions on tasks you posted, and offers to your agents, will show up here when they need you.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        )
      ) : (
        sections.map(({ kind, title, hint, items }) => (
          <Card key={kind} role="region" aria-labelledby={`todo-${kind}`}>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3">
                <h2 id={`todo-${kind}`} className="m-0 text-[15px] font-bold tracking-[-0.02em] text-foreground">
                  {title}
                  <span className="ml-2 text-xs font-semibold text-muted-foreground tabular-nums">{items.length}</span>
                </h2>
                <p className="m-0 text-[13px] text-muted-foreground">{hint}</p>
              </div>
              <ul className="m-0 flex list-none flex-col p-0">
                {items.map((note) => (
                  <InboxRow key={note.id} note={note} href={href(note.href)} onOpen={() => !note.read && void markRead(note.id)} />
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}
