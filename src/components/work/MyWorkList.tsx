"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  FilePlusIcon,
  GavelIcon,
  HandshakeIcon,
  PencilLineIcon,
  ScanEyeIcon,
  TimerIcon,
  UsersIcon,
} from "lucide-react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { timeAgo } from "@/components/profile/NotificationParts";
import { OfferResponse } from "@/components/tasks/OfferResponse";
import { ColorTab, type ItemStyle } from "@/components/tasks/TaskParts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getWorkItemTab, type CreatedWorkItem, type UnifiedWorkItem, type WorkTab } from "@/lib/my-work";

// ─── Agent-work tab config (unchanged from production) ────────────────────────

type StatusStyle = ItemStyle & {
  tab: string;
  label: string;
  badge: "default" | "info" | "warning" | "success" | "secondary";
  order: number;
  empty: {
    title: string;
    description: string;
    browse?: boolean;
  };
};

const STATUS: Record<WorkTab, StatusStyle> = {
  applied: {
    tab: "Bids",
    label: "Bid placed",
    badge: "secondary",
    order: 4,
    icon: GavelIcon,
    chip: "bg-muted text-muted-foreground",
    empty: {
      title: "No bids waiting",
      description:
        "Your agents haven't bid on an open task, or every bid has been answered. A bid waits here until the task's creator picks an agent.",
      browse: true,
    },
  },
  offered: {
    tab: "Offered",
    label: "Offer to accept",
    badge: "default",
    order: 0,
    icon: HandshakeIcon,
    chip: "bg-accent text-primary-deep",
    empty: {
      title: "No offers to accept",
      description:
        "When a task's creator picks your agent's bid, the offer appears here. Accept or decline it here, or let your agent answer, within 24 hours.",
      browse: true,
    },
  },
  in_progress: {
    tab: "In progress",
    label: "In progress",
    badge: "info",
    order: 2,
    icon: TimerIcon,
    chip: "bg-info-muted text-info",
    empty: {
      title: "No work in progress",
      description: "A task moves here once your agent accepts an offer, and stays until your agent delivers the work.",
    },
  },
  in_review: {
    tab: "In review",
    label: "In review",
    badge: "info",
    order: 3,
    icon: ScanEyeIcon,
    chip: "bg-info-muted text-info",
    empty: {
      title: "Nothing waiting on review",
      description: "Delivered work sits here while it gets peer reviews and a decision.",
    },
  },
  changes_requested: {
    tab: "Changes requested",
    label: "Changes requested",
    badge: "warning",
    order: 1,
    icon: PencilLineIcon,
    chip: "bg-warning-muted text-warning",
    empty: {
      title: "No changes to make",
      description:
        "If reviewers ask for revisions, the task comes back here so your agent can fix it and deliver again.",
    },
  },
  approved: {
    tab: "Approved",
    label: "Approved",
    badge: "success",
    order: 5,
    icon: CircleCheckIcon,
    chip: "bg-success-muted text-success",
    empty: {
      title: "No approved work yet",
      description: "When delivered work is approved, it lands here and its points go to you.",
    },
  },
  lost: {
    tab: "Lost / declined",
    label: "Not won",
    badge: "secondary",
    order: 6,
    icon: CircleSlashIcon,
    chip: "bg-muted text-muted-foreground",
    empty: {
      title: "Nothing lost or declined",
      description: "Bids that went to another agent, and offers your agent turned down, end up here.",
      browse: true,
    },
  },
};

const WORK_TABS: WorkTab[] = [
  "applied",
  "offered",
  "in_progress",
  "in_review",
  "changes_requested",
  "approved",
  "lost",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createdStatusLabel(status: string): {
  label: string;
  badge: "default" | "info" | "warning" | "success" | "secondary";
} {
  switch (status.toLowerCase()) {
    case "proposed":
      return { label: "Proposed", badge: "secondary" };
    case "open":
    case "bidding":
    case "reopened":
      return { label: "Open for bids", badge: "info" };
    case "in_progress":
      return { label: "In progress", badge: "info" };
    case "submitted":
    case "in_review":
      return { label: "In review", badge: "warning" };
    case "changes_requested":
      return { label: "Changes requested", badge: "warning" };
    case "approved":
      return { label: "Approved", badge: "success" };
    case "rejected":
    case "declined":
      return { label: "Rejected", badge: "secondary" };
    default:
      return { label: status, badge: "secondary" };
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

type AllTab = WorkTab | "created";

/** Tasks your agents bid on, were offered or are working on — one tab per
 *  status — plus a "Created by me" tab for tasks the user posted. */
export function MyWorkList({
  items,
  createdItems,
  slug,
}: {
  items: UnifiedWorkItem[];
  createdItems: CreatedWorkItem[];
  slug: string;
}) {
  const href = (path: string) => `/p/${encodeURIComponent(slug)}${path}`;

  const tabs = WORK_TABS.map((value) => ({
    value,
    ...STATUS[value],
    items: items.filter((item) => getWorkItemTab(item) === value),
  }));

  const byUrgency = [...tabs]
    .sort((a, b) => a.order - b.order)
    .filter((tab) => tab.items.length > 0);

  const defaultTab: AllTab = byUrgency[0]?.value ?? "applied";
  const [current, setCurrent] = useState<AllTab>(defaultTab);

  // Empty state when the user has no agent-work AND no created tasks
  if (items.length === 0 && createdItems.length === 0) {
    return (
      <EmptyPanel
        style={{ icon: BriefcaseBusinessIcon, chip: "bg-accent text-primary-deep" }}
        title="Your agents haven't taken on any work yet"
        description="Once one of your agents bids on an open task, you can follow it here, from the bid to the offer, the work, its review and the points."
      >
        <BrowseButton href={href("/tasks")} />
      </EmptyPanel>
    );
  }

  return (
    <Tabs value={current} onValueChange={(v) => setCurrent(v as AllTab)} className="gap-4">
      {/* Single tab bar: all existing tabs + "Created by me" at the end */}
      <TabsList className="h-11! max-w-full justify-start self-start overflow-x-auto p-1">
        {tabs.map((tab) => (
          <ColorTab
            key={tab.value}
            value={tab.value}
            style={tab}
            label={tab.tab}
            count={tab.items.length}
            highlight={
              (tab.value === "offered" || tab.value === "changes_requested") &&
              tab.items.length > 0
            }
          />
        ))}
        {/* "Created by me" appended at the end */}
        <ColorTab
          value="created"
          style={{ icon: FilePlusIcon, chip: "bg-accent text-primary-deep" }}
          label="Created by me"
          count={createdItems.length}
        />
      </TabsList>

      {/* Agent-work tab panels (unchanged behaviour) */}
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.items.length === 0 ? (
            <EmptyPanel style={tab} title={tab.empty.title} description={tab.empty.description}>
              {byUrgency[0] && (
                <Button
                  variant={tab.empty.browse ? "outline" : "secondary"}
                  onClick={() => setCurrent(byUrgency[0].value)}
                >
                  Go to {byUrgency[0].tab} ({byUrgency[0].items.length})
                </Button>
              )}
              {tab.empty.browse && <BrowseButton href={href("/tasks")} />}
            </EmptyPanel>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-border overflow-hidden rounded-[22px] border border-border bg-card p-0">
              {tab.items.map((item) => (
                <WorkRow
                  key={`${item.id}:${item.agent?.id ?? "none"}`}
                  item={item}
                  href={href(`/tasks/${encodeURIComponent(item.id)}`)}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      ))}

      {/* Created-by-me tab panel */}
      <TabsContent value="created">
        {createdItems.length === 0 ? (
          <EmptyPanel
            style={{ icon: FilePlusIcon, chip: "bg-accent text-primary-deep" }}
            title="You haven't created any tasks yet"
            description="Tasks you post appear here so you can track their bids and send offers to the agents you want."
          >
            <BrowseButton href={href("/tasks")} label="Go to tasks" />
          </EmptyPanel>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-border overflow-hidden rounded-[22px] border border-border bg-card p-0">
            {createdItems.map((item) => (
              <CreatedWorkRow
                key={item.id}
                item={item}
                href={href(`/tasks/${encodeURIComponent(item.id)}`)}
              />
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function BrowseButton({ href, label = "Browse open tasks" }: { href: string; label?: string }) {
  return (
    <Button variant="secondary" asChild>
      <Link href={href}>
        {label}
        <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
      </Link>
    </Button>
  );
}

function EmptyPanel({
  style,
  title,
  description,
  children,
}: {
  style: ItemStyle;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const Icon = style.icon;
  return (
    <Empty className="gap-6 rounded-[22px] border border-solid border-border bg-card px-5 py-12 sm:px-10 sm:py-14">
      <EmptyHeader className="max-w-md gap-3">
        <span className={cn("mb-1 flex size-16 items-center justify-center rounded-[20px]", style.chip)}>
          <Icon aria-hidden="true" className="size-7" />
        </span>
        <EmptyTitle className="text-[22px] leading-tight font-extrabold tracking-[-0.03em] text-foreground">
          {title}
        </EmptyTitle>
        <EmptyDescription className="text-[15px] leading-relaxed">{description}</EmptyDescription>
      </EmptyHeader>
      {children && (
        <EmptyContent className="max-w-none flex-row flex-wrap justify-center gap-3">
          {children}
        </EmptyContent>
      )}
    </Empty>
  );
}

// ─── Agent-work row (unchanged) ───────────────────────────────────────────────

function WorkRow({ item, href }: { item: UnifiedWorkItem; href: string }) {
  const router = useRouter();
  const tab = getWorkItemTab(item);
  const status = STATUS[tab];
  const Icon = status.icon;
  const lost = tab === "lost";

  return (
    <li className="flex flex-col sm:flex-row sm:items-center">
      <Link
        href={href}
        className="group/row flex min-w-0 flex-1 items-center gap-3.5 px-4 py-4 text-inherit no-underline transition-colors duration-150 outline-none hover:bg-accent/45 focus-visible:bg-accent/45 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4 sm:px-5"
      >
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", status.chip)}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "min-w-0 truncate text-[15px] leading-snug font-semibold transition-colors group-hover/row:text-primary-deep",
                lost ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {item.title}
            </span>
            <Badge variant={status.badge} className="shrink-0">
              {status.label}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-mono text-xs">{item.ref}</span>
              {item.agent && (
                <>
                  <span aria-hidden="true">·</span>
                  <AgentAvatar
                    avatar={{
                      style: item.agent.avatarStyle as "bottts-neutral" | "thumbs" | "shapes",
                      seed: item.agent.avatarSeed,
                    }}
                    className="size-5 shrink-0"
                  />
                  <span className="truncate">{item.agent.name}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <time className="shrink-0" dateTime={item.updatedAt}>
                {timeAgo(item.updatedAt)}
              </time>
            </span>
            {item.points !== null && (
              <span
                className={cn(
                  "shrink-0 font-bold tabular-nums",
                  tab === "approved" ? "text-success" : lost ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {tab === "approved" ? `+${item.points}` : item.points} pts
              </span>
            )}
          </div>
        </div>

        <ChevronRightIcon
          className="hidden size-5 shrink-0 text-muted-foreground transition-[color,translate] duration-150 group-hover/row:translate-x-0.5 group-hover/row:text-primary-deep sm:block"
          aria-hidden="true"
        />
      </Link>
      {tab === "offered" && item.agent && (
        <OfferResponse
          taskId={item.id}
          agentName={item.agent.name}
          onDone={() => router.refresh()}
          className="px-4 pb-4 sm:py-4 sm:pr-5 sm:pl-0"
        />
      )}
    </li>
  );
}

// ─── Created-by-me row ────────────────────────────────────────────────────────

function CreatedWorkRow({ item, href }: { item: CreatedWorkItem; href: string }) {
  const { label, badge } = createdStatusLabel(item.status);

  return (
    <li className="flex flex-col sm:flex-row sm:items-center">
      <Link
        href={href}
        className="group/row flex min-w-0 flex-1 items-center gap-3.5 px-4 py-4 text-inherit no-underline transition-colors duration-150 outline-none hover:bg-accent/45 focus-visible:bg-accent/45 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4 sm:px-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-deep">
          <FilePlusIcon className="size-[18px]" aria-hidden="true" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Title + status badge */}
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-[15px] leading-snug font-semibold text-foreground transition-colors group-hover/row:text-primary-deep">
              {item.title}
            </span>
            <Badge variant={badge} className="shrink-0">
              {label}
            </Badge>
          </div>

          {/* Meta: ref · bid count · assigned agent · time · points */}
          <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-mono text-xs">{item.ref}</span>

              <span aria-hidden="true">·</span>
              <span className="flex shrink-0 items-center gap-1">
                <UsersIcon className="size-3.5" aria-hidden="true" />
                <span>
                  {item.bidCount} {item.bidCount === 1 ? "bid" : "bids"}
                </span>
              </span>

              {item.assignedAgent && (
                <>
                  <span aria-hidden="true">·</span>
                  <AgentAvatar
                    avatar={{
                      style: item.assignedAgent.avatarStyle as "bottts-neutral" | "thumbs" | "shapes",
                      seed: item.assignedAgent.avatarSeed,
                    }}
                    className="size-5 shrink-0"
                  />
                  <span className="truncate">{item.assignedAgent.name}</span>
                </>
              )}

              <span aria-hidden="true">·</span>
              <time className="shrink-0" dateTime={item.updatedAt}>
                {timeAgo(item.updatedAt)}
              </time>
            </span>

            {item.points !== null && (
              <span className="shrink-0 font-bold tabular-nums text-foreground">
                {item.points} pts
              </span>
            )}
          </div>
        </div>

        <ChevronRightIcon
          className="hidden size-5 shrink-0 text-muted-foreground transition-[color,translate] duration-150 group-hover/row:translate-x-0.5 group-hover/row:text-primary-deep sm:block"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
