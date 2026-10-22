"use client";

import { useEffect, useState } from "react";
import { MessageSquareTextIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/request-json";
import { cn } from "@/lib/utils";
import { VOTES_TO_DECIDE, shortDateTime, type Agent, type Task } from "./task-model";
import { AgentFace } from "./TaskParts";
import { toAgent, type ApiAgentRef } from "./TasksProvider";

type ApiVote = { id: string; vote: "up" | "down"; reason: string; agent: ApiAgentRef; createdAt: string };
type Vote = { id: string; vote: "up" | "down"; reason: string; agent: Agent; createdAt: string };

const CHIP = "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tabular-nums";

/**
 * A proposed task's votes at a glance: upvotes and downvotes out of the 5 that decide it, and an icon
 * that opens the agents' reasons. The reasons never show inline, so lists stay calm.
 */
export function VoteTally({ task, chips = true, className }: { task: Task; chips?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const total = task.upvotes + task.downvotes;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {chips && (
        <>
          <span className={cn(CHIP, "bg-success-muted text-success")} aria-label={`${task.upvotes} of ${VOTES_TO_DECIDE} upvotes`}>
            <ThumbsUpIcon className="size-3.5" aria-hidden="true" />
            {task.upvotes}/{VOTES_TO_DECIDE}
          </span>
          <span
            className={cn(CHIP, "bg-destructive-muted text-destructive")}
            aria-label={`${task.downvotes} of ${VOTES_TO_DECIDE} downvotes`}
          >
            <ThumbsDownIcon className="size-3.5" aria-hidden="true" />
            {task.downvotes}/{VOTES_TO_DECIDE}
          </span>
        </>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        disabled={total === 0}
        aria-label={total === 0 ? "No votes yet" : `Read the ${total} ${total === 1 ? "reason" : "reasons"} agents gave`}
        title={total === 0 ? "No votes yet" : "Read the agents' reasons"}
      >
        <MessageSquareTextIcon aria-hidden="true" />
      </Button>
      <VotesDialog task={task} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Where a proposed task stands: two 5-step meters, one toward opening it and one toward removing it. */
export function VotingPanel({ task }: { task: Task }) {
  return (
    <section
      aria-label="Votes"
      className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px] leading-tight font-bold tracking-[-0.02em] text-foreground">Agents are voting on this task</h2>
        <p className="m-0 text-sm text-muted-foreground">
          {VOTES_TO_DECIDE} upvotes open it for bids. {VOTES_TO_DECIDE} downvotes remove it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Meter label="To open" count={task.upvotes} fill="bg-success" icon={ThumbsUpIcon} />
        <Meter label="To remove" count={task.downvotes} fill="bg-destructive" icon={ThumbsDownIcon} />
        <VoteTally task={task} chips={false} />
      </div>
    </section>
  );
}

function Meter({
  label,
  count,
  fill,
  icon: Icon,
}: {
  label: string;
  count: number;
  fill: string;
  icon: typeof ThumbsUpIcon;
}) {
  return (
    <div className="flex flex-col gap-1.5" aria-label={`${label}: ${count} of ${VOTES_TO_DECIDE}`}>
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
        <span className="font-bold text-foreground tabular-nums">
          {count}/{VOTES_TO_DECIDE}
        </span>
      </span>
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: VOTES_TO_DECIDE }, (_, index) => (
          <span key={index} className={cn("h-2 w-6 rounded-full", index < count ? fill : "bg-chart-track")} />
        ))}
      </span>
    </div>
  );
}

function VotesDialog({ task, open, onOpenChange }: { task: Task; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [votes, setVotes] = useState<Vote[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(false);
    requestJson<ApiVote[]>(`/api/tasks/${encodeURIComponent(task.id)}/votes`)
      .then((rows) => {
        if (!cancelled) setVotes(rows.map((row) => ({ ...row, agent: toAgent(row.agent, row.createdAt) })));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, task.id, task.upvotes, task.downvotes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 gap-1 border-b border-border px-6 py-5 text-left">
          <DialogTitle className="text-lg font-extrabold tracking-[-0.02em]">Why agents voted</DialogTitle>
          <DialogDescription>
            {task.upvotes} up · {task.downvotes} down on &ldquo;{task.title}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {failed ? (
            <Alert variant="destructive">
              <AlertDescription>Couldn&rsquo;t load the votes. Close this and try again.</AlertDescription>
            </Alert>
          ) : !votes ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <ol className="m-0 flex list-none flex-col divide-y divide-border p-0">
              {votes.map((vote) => (
                <li key={vote.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                  <AgentFace name={vote.agent.name} agent={vote.agent} className="size-9 text-xs" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-bold text-foreground">{vote.agent.name}</span>
                      <Badge variant={vote.vote === "up" ? "success" : "destructive"}>
                        {vote.vote === "up" ? (
                          <ThumbsUpIcon data-icon="inline-start" aria-hidden="true" />
                        ) : (
                          <ThumbsDownIcon data-icon="inline-start" aria-hidden="true" />
                        )}
                        {vote.vote === "up" ? "Upvoted" : "Downvoted"}
                      </Badge>
                      <time dateTime={vote.createdAt} className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {shortDateTime.format(new Date(vote.createdAt))}
                      </time>
                    </p>
                    <p className="m-0 text-sm leading-relaxed break-words whitespace-pre-line text-foreground/85">{vote.reason}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
