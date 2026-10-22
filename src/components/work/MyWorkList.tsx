"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusinessIcon } from "lucide-react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo } from "@/components/profile/NotificationParts";
import { cn } from "@/lib/utils";
import { getWorkItemTab, type UnifiedWorkItem, type WorkTab } from "@/lib/my-work";

export type MyWorkStage = WorkTab;
export type MyWorkTask = UnifiedWorkItem;

export const STAGES: {
  value: WorkTab;
  label: string;
  badge: "info" | "warning" | "success" | "destructive" | "secondary";
}[] = [
  { value: "applied", label: "Bids", badge: "info" },
  { value: "offered", label: "Offered", badge: "info" },
  { value: "in_progress", label: "In progress", badge: "warning" },
  { value: "in_review", label: "In review", badge: "info" },
  { value: "changes_requested", label: "Changes requested", badge: "warning" },
  { value: "approved", label: "Approved", badge: "success" },
  { value: "lost", label: "Lost / declined", badge: "secondary" },
];

export function TaskRow({ task, slug }: { task: UnifiedWorkItem; slug: string }) {
  const currentTab = getWorkItemTab(task);
  const stage = STAGES.find((item) => item.value === currentTab) ?? STAGES[0];

  const href =
    task.type === "idea"
      ? task.status === "ACCEPTED" || currentTab === "approved"
        ? `/p/${encodeURIComponent(slug)}/goals/${encodeURIComponent(task.goalId)}/workstreams/${encodeURIComponent(task.id)}`
        : `/p/${encodeURIComponent(slug)}/goals/${encodeURIComponent(task.goalId)}`
      : `/p/${encodeURIComponent(slug)}/goals/${encodeURIComponent(task.goalId)}/workstreams/${encodeURIComponent(task.workstreamId || "")}/tasks/${encodeURIComponent(task.id)}`;

  return (
    <Link
      href={href}
      className="grid gap-3 rounded-[18px] border border-border bg-card p-4 text-inherit no-underline transition-colors hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.4fr)_90px_140px] sm:items-center sm:px-5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant={task.type === "idea" ? "secondary" : "outline"}
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5"
          >
            {task.type}
          </Badge>
          <p className="m-0 truncate font-semibold text-foreground">{task.title}</p>
        </div>
        <p className="m-0 mt-1 truncate text-xs text-muted-foreground">
          {task.breadcrumbs?.goalTitle ?? task.goalTitle}
          {task.breadcrumbs?.workstreamTitle || task.workstreamTitle ? (
            <>
              {" "}
              <span aria-hidden="true">›</span>{" "}
              {task.breadcrumbs?.workstreamTitle ?? task.workstreamTitle}
            </>
          ) : null}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {task.agent ? (
          <>
            <AgentAvatar
              avatar={{
                style: task.agent.avatarStyle as "bottts-neutral" | "thumbs" | "shapes",
                seed: task.agent.avatarSeed,
              }}
              className="size-6"
            />
            <span className="truncate text-sm text-foreground">{task.agent.name}</span>
          </>
        ) : (
          <span className="truncate text-xs text-muted-foreground">No agent</span>
        )}
      </div>

      <span className="font-mono text-sm tabular-nums text-foreground">
        {task.points !== null ? `${task.points} pts` : "—"}
      </span>

      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
        <Badge variant={stage.badge}>{stage.label}</Badge>
        <time className="text-xs text-muted-foreground" dateTime={task.updatedAt}>
          {timeAgo(task.updatedAt)}
        </time>
      </div>
    </Link>
  );
}

export function MyWorkList({
  items,
  tasks,
  slug,
}: {
  items?: UnifiedWorkItem[];
  tasks?: UnifiedWorkItem[];
  slug: string;
}) {
  const allItems = items ?? tasks ?? [];
  const [stage, setStage] = useState<WorkTab>("applied");

  // Compute the total number of tasks/items belonging to each status category dynamically
  const counts = useMemo(() => {
    const map: Record<WorkTab, number> = {
      applied: 0,
      offered: 0,
      in_progress: 0,
      in_review: 0,
      changes_requested: 0,
      approved: 0,
      lost: 0,
    };
    for (const item of allItems) {
      const tab = getWorkItemTab(item);
      map[tab] = (map[tab] ?? 0) + 1;
    }
    return map;
  }, [allItems]);

  // Strictly filter the unified work items array using the status mapping logic
  const visible = useMemo(
    () => allItems.filter((item) => getWorkItemTab(item) === stage),
    [allItems, stage]
  );

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={stage} onValueChange={(value) => setStage(value as WorkTab)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted p-1 sm:w-fit">
          {STAGES.map((item) => {
            const count = counts[item.value] ?? 0;
            const isActive = stage === item.value;
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="flex-none gap-1.5 px-3 py-2"
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums transition-colors",
                    isActive
                      ? "bg-muted text-foreground font-semibold"
                      : "bg-muted-foreground/15 text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {visible.length ? (
        <div className="flex flex-col gap-2">
          {visible.map((task) => (
            <TaskRow
              key={`${task.type}:${task.id}:${task.agent?.id ?? "none"}`}
              task={task}
              slug={slug}
            />
          ))}
        </div>
      ) : (
        <Empty className="min-h-56 rounded-[22px] border border-border bg-card">
          <EmptyHeader>
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary-deep">
              <BriefcaseBusinessIcon aria-hidden="true" className="size-5" />
            </span>
            <EmptyTitle>
              No {STAGES.find((item) => item.value === stage)?.label.toLowerCase()} work
            </EmptyTitle>
            <EmptyDescription>Work items your agents interact with will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
