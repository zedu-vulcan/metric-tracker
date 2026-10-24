"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { useProject } from "@/components/projects/ProjectProvider";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/request-json";
import { cn } from "@/lib/utils";
import { shortDateTime, type Agent, type Task } from "./task-model";
import { AgentFace } from "./TaskParts";
import { toAgent, useTasks, type ApiAgentRef } from "./TasksProvider";

type VoteValue = "up" | "down";
type VotePerson = { id: string; name: string | null; image: string | null };
type ApiVote = { id: string; vote: VoteValue; reason: string; agent: ApiAgentRef | null; user: VotePerson | null; createdAt: string };
type Vote = { id: string; vote: VoteValue; reason: string; agent: Agent | null; user: VotePerson | null; createdAt: string };

function toVote(row: ApiVote): Vote {
  return { ...row, agent: row.agent ? toAgent(row.agent, row.createdAt) : null };
}

/** Every vote on the task; refetched when its tally changes. */
function useVotes(task: Task, enabled = true) {
  const [votes, setVotes] = useState<Vote[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setFailed(false);
    requestJson<ApiVote[]>(`/api/tasks/${encodeURIComponent(task.id)}/votes`)
      .then((rows) => !cancelled && setVotes(rows.map(toVote)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [enabled, task.id, task.upvotes, task.downvotes]);

  return { votes, failed };
}

const CHIP = "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tabular-nums";

/**
 * A proposed task's votes at a glance: upvotes and downvotes out of the number that decides it, and an icon
 * that opens the agents' reasons. The reasons never show inline, so lists stay calm.
 */
export function VoteTally({ task, chips = true, className }: { task: Task; chips?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const { votesToDecide } = useProject().pointSettings;
  const total = task.upvotes + task.downvotes;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {chips && (
        <>
          <span className={cn(CHIP, "bg-success-muted text-success")} aria-label={`${task.upvotes} of ${votesToDecide} upvotes`}>
            <ThumbsUpIcon className="size-3.5" aria-hidden="true" />
            {task.upvotes}/{votesToDecide}
          </span>
          <span
            className={cn(CHIP, "bg-destructive-muted text-destructive")}
            aria-label={`${task.downvotes} of ${votesToDecide} downvotes`}
          >
            <ThumbsDownIcon className="size-3.5" aria-hidden="true" />
            {task.downvotes}/{votesToDecide}
          </span>
        </>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        disabled={total === 0}
        aria-label={total === 0 ? "No votes yet" : `Read the ${total} ${total === 1 ? "reason" : "reasons"} agents gave`}
        title={total === 0 ? "No votes yet" : "Read the reasons behind the votes"}
      >
        <MessageSquareTextIcon aria-hidden="true" />
      </Button>
      <VotesDialog task={task} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/**
 * Where a proposed task stands: two meters, one toward opening it and one toward removing it, and the
 * signed-in person's own vote (anyone but the poster votes once, with a reason).
 */
export function VotingPanel({ task }: { task: Task }) {
  const { votesToDecide, votePoints } = useProject().pointSettings;
  const { currentUser } = useTasks();
  const { votes } = useVotes(task);
  const [voting, setVoting] = useState<VoteValue | null>(null);
  const isPoster = task.createdById === currentUser.id;
  const myVote = votes?.find((vote) => vote.user?.id === currentUser.id);

  return (
    <section aria-label="Votes" className="flex flex-col gap-5 rounded-[22px] border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[17px] leading-tight font-bold tracking-[-0.02em] text-foreground">This task is up for a vote</h2>
          <p className="m-0 text-sm text-muted-foreground">
            {votesToDecide} upvotes open it for bids. {votesToDecide} downvotes remove it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Meter label="To open" count={task.upvotes} fill="bg-success" icon={ThumbsUpIcon} />
          <Meter label="To remove" count={task.downvotes} fill="bg-destructive" icon={ThumbsDownIcon} />
          <VoteTally task={task} chips={false} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm text-muted-foreground">
          {isPoster
            ? "You posted this task, so you can't vote on it."
            : myVote
              ? `You ${myVote.vote === "up" ? "upvoted" : "downvoted"} this task.`
              : votes
                ? `Does this task serve the project's focus? Vote with a reason${votePoints > 0 ? ` and earn ${votePoints} pts` : ""}.`
                : ""}
        </p>
        {!isPoster && votes && !myVote && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setVoting("down")}>
              <ThumbsDownIcon data-icon="inline-start" aria-hidden="true" />
              Downvote
            </Button>
            <Button variant="outline" size="sm" onClick={() => setVoting("up")}>
              <ThumbsUpIcon data-icon="inline-start" aria-hidden="true" />
              Upvote
            </Button>
          </div>
        )}
      </div>
      <CastVoteDialog task={task} vote={voting} onOpenChange={(open) => !open && setVoting(null)} />
    </section>
  );
}

function CastVoteDialog({
  task,
  vote,
  onOpenChange,
}: {
  task: Task;
  vote: VoteValue | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { href } = useProject();
  const { loadTask } = useTasks();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < 10;

  const close = useCallback(() => {
    setReason("");
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const submit = async () => {
    if (!vote) return;
    setPending(true);
    setError(null);
    try {
      const result = await requestJson<{ outcome: "pending" | "opened" | "removed" }>(
        `/api/tasks/${encodeURIComponent(task.id)}/votes`,
        { method: "POST", body: JSON.stringify({ vote, reason: reason.trim() }) }
      );
      close();
      if (result.outcome === "removed") router.push(href("/tasks"));
      else loadTask(task.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save your vote. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={vote !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{vote === "down" ? "Downvote this task" : "Upvote this task"}</DialogTitle>
          <DialogDescription>Everyone can read your reason behind the task&rsquo;s votes icon. You vote once.</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field data-invalid={error && tooShort ? true : undefined}>
          <FieldLabel htmlFor={`vote-reason-${task.id}`}>Why?</FieldLabel>
          <Textarea
            id={`vote-reason-${task.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              vote === "down"
                ? "e.g. Paid ads are out of scope for this project."
                : "e.g. /pricing is our top landing page, so fixing it serves the sign-ups focus."
            }
            rows={3}
            maxLength={1000}
            aria-invalid={error && tooShort ? true : undefined}
          />
          {error && tooShort ? (
            <FieldError>Say why in a sentence or two.</FieldError>
          ) : (
            <FieldDescription>A sentence or two, at least 10 characters.</FieldDescription>
          )}
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={() => void submit()} disabled={pending || tooShort}>
            {pending && <Spinner data-icon="inline-start" />}
            {vote === "down" ? "Downvote" : "Upvote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { votesToDecide } = useProject().pointSettings;
  return (
    <div className="flex flex-col gap-1.5" aria-label={`${label}: ${count} of ${votesToDecide}`}>
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
        <span className="font-bold text-foreground tabular-nums">
          {count}/{votesToDecide}
        </span>
      </span>
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: votesToDecide }, (_, index) => (
          <span key={index} className={cn("h-2 w-6 rounded-full", index < count ? fill : "bg-chart-track")} />
        ))}
      </span>
    </div>
  );
}

function VotesDialog({ task, open, onOpenChange }: { task: Task; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { votes, failed } = useVotes(task, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 gap-1 border-b border-border px-6 py-5 text-left">
          <DialogTitle className="text-lg font-extrabold tracking-[-0.02em]">Why it got these votes</DialogTitle>
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
                  <AgentFace name={voterName(vote)} agent={vote.agent ?? undefined} className="size-9 text-xs" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-bold text-foreground">{voterName(vote)}</span>
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

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4 mx-0 mb-0">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function voterName(vote: Vote) {
  return vote.agent?.name ?? vote.user?.name ?? "A teammate";
}
