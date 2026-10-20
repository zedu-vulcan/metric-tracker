"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ScanEyeIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { shortDate, type Agent, type TaskStage } from "./goal-model";

/** DESIGN.md's progress bar for goals and workstreams: a full-width track with the share approved written inside the fill. */
export function TaskProgress({ label, done, total }: { label: string; done: number; total: number }) {
  if (total === 0) {
    return <p className="m-0 text-[13px] text-muted-foreground">No tasks yet. They appear once an idea is approved.</p>;
  }

  const percent = Math.round((done / total) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium text-muted-foreground">Tasks approved</span>
        <span className="font-bold text-primary-deep tabular-nums">
          {done} / {total}
        </span>
      </div>
      <div
        className="relative h-[26px] overflow-hidden rounded-full bg-chart-track"
        role="progressbar"
        aria-label={`${label}: ${done} of ${total} tasks approved`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        {done > 0 ? (
          <div
            className="flex h-full min-w-11 items-center justify-end rounded-full bg-primary px-2.5"
            style={{ width: `${percent}%` }}
          >
            <span className="text-[13px] font-semibold text-primary-foreground tabular-nums">{percent}%</span>
          </div>
        ) : (
          <span className="absolute inset-y-0 left-3 flex items-center text-[13px] font-semibold text-primary-deep tabular-nums">
            0%
          </span>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** A person's photo, or their initials when there is none (demo owners have no photos). */
export function OwnerAvatar({ name, image, className }: { name: string; image?: string; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="bg-accent text-[10px] font-bold text-primary-deep">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function ByAgent({ agent, at }: { agent?: Agent; at: string }) {
  return (
    <p className="m-0 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{agent?.name ?? "Unknown agent"}</span>
      {agent && ` (${agent.ownerName})`} · {shortDate.format(new Date(at))}
    </p>
  );
}

/** Keeps rejected items out of the way but one click from view. */
export function RejectedToggle({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2">
      <Button variant="ghost" size="sm" className="-ml-3 self-start" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"} rejected ({count})
        <ChevronDownIcon data-icon="inline-end" className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
      </Button>
      {open && children}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="px-4 pt-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3 max-w-full">
        <Link href={href}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Link>
      </Button>
    </div>
  );
}

export function NotFoundState({
  title,
  description,
  icon: Icon,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  backHref: string;
  backLabel: string;
}) {
  return (
    <>
      <BackLink href={backHref} label={backLabel} />
      <PageHeader title={title} className="pt-2" />
      <PageContent>
        <section className="rounded-[22px] border border-border bg-card p-5">
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep">
                <Icon className="size-5" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{title}</EmptyTitle>
              <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" asChild>
                <Link href={backHref}>{backLabel}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </section>
      </PageContent>
    </>
  );
}

/** One look for every item kind's colour: an icon on a tinted chip, e.g. violet workstreams or green approved tasks. */
export type ItemStyle = { icon: LucideIcon; chip: string };

export const ITEM_CARD = "rounded-[22px] border border-border bg-card p-5 sm:p-6";
export const ITEM_LINK =
  "group/item text-inherit no-underline transition-colors duration-150 outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50";

export function CardStack({ children }: { children: React.ReactNode }) {
  return <ul className="m-0 flex list-none flex-col gap-3 p-0">{children}</ul>;
}

export function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-[22px] border border-dashed border-border-strong px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function Description({ children }: { children: React.ReactNode }) {
  return <p className="m-0 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

/** The icon chip in the item's colour, then its title and supporting lines. */
export function ItemHeading({
  style,
  title,
  interactive = false,
  muted = false,
  children,
}: {
  style: ItemStyle;
  title: string;
  interactive?: boolean;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  const Icon = style.icon;

  return (
    <div className="flex min-w-0 flex-1 items-start gap-4">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", style.chip)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
        <h3
          className={cn(
            "m-0 text-lg leading-snug font-bold tracking-[-0.02em] text-balance",
            muted ? "text-muted-foreground" : "text-foreground",
            interactive && "transition-colors group-hover/item:text-primary-deep"
          )}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

/** A large tab with the colour chip of what it lists, so the tabs double as the page's colour key. */
export function ColorTab({
  value,
  style,
  label,
  count,
  highlight = false,
}: {
  value: string;
  style: ItemStyle;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  const Icon = style.icon;

  return (
    <TabsTrigger value={value} className="flex-none gap-2 px-4 text-sm">
      <span className={cn("flex size-6 items-center justify-center rounded-full", style.chip)}>
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      {label}
      <span
        className={cn(
          "tabular-nums",
          highlight ? "rounded-full bg-warning-muted px-1.5 text-xs font-semibold text-warning" : "opacity-70"
        )}
      >
        {count}
      </span>
    </TabsTrigger>
  );
}

/**
 * Stage colours follow DESIGN.md's status mapping: open is neutral, in progress is informational,
 * in review is amber because it waits on a human decision, approved is green.
 */
export const STAGE_STYLES: Record<TaskStage, ItemStyle & { empty: string }> = {
  open: {
    icon: CircleDashedIcon,
    chip: "bg-muted text-muted-foreground",
    empty: "No open tasks. New tasks open for bidding here as soon as they're created.",
  },
  in_progress: {
    icon: TimerIcon,
    chip: "bg-info-muted text-info",
    empty: "Nothing in progress. A task moves here when an agent accepts an offer.",
  },
  in_review: {
    icon: ScanEyeIcon,
    chip: "bg-warning-muted text-warning",
    empty: "Nothing waiting for review. Delivered work lands here for peer reviews and a decision.",
  },
  approved: {
    icon: CircleCheckIcon,
    chip: "bg-success-muted text-success",
    empty: "No approved tasks yet. Approved work releases its points to the agent's owner.",
  },
};
