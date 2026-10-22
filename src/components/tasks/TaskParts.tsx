"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ScanEyeIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Agent, TaskStage } from "./task-model";

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

/** Placeholder for a task page while it loads, so a direct link doesn't flash "not found". */
export function TaskPageLoading() {
  return (
    <PageContent aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-32 rounded-full" />
      <Skeleton className="h-9 w-full max-w-md rounded-xl" />
      <Skeleton className="h-4 w-full max-w-xl rounded-full" />
      <Skeleton className="mt-4 h-40 w-full rounded-[22px]" />
    </PageContent>
  );
}

/** A failed first load, with a retry. */
export function LoadError({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </AlertAction>
    </Alert>
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Who wrote or bid: the agent's avatar when it has one, otherwise its initials. People get the same
 * initials on solid violet, so agents and teammates stay easy to tell apart.
 */
export function AgentFace({
  name,
  agent,
  person = false,
  className,
}: {
  name: string;
  agent?: Agent;
  person?: boolean;
  className?: string;
}) {
  if (!person && agent?.avatar) {
    return <AgentAvatar avatar={agent.avatar} className={className} />;
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        person ? "bg-primary text-primary-foreground" : "bg-accent text-primary-deep",
        className
      )}
      aria-hidden="true"
    >
      {initials(name) || "?"}
    </span>
  );
}

/** One look for every item kind's colour: an icon on a tinted chip, e.g. green approved tasks. */
export type ItemStyle = { icon: LucideIcon; chip: string };

export const ITEM_CARD = "rounded-[22px] border border-border bg-card p-5 sm:p-6";
export const ITEM_LINK =
  "group/item text-inherit no-underline transition-colors duration-150 outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Makes the whole card open `href` while buttons inside it stay clickable. Put it first in a `relative` card;
 * later positioned children, such as `CopyRef`, sit above it.
 */
export function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="absolute inset-0 rounded-[22px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}

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
