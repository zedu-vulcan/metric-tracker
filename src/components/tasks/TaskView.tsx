"use client";

import { useProject } from "@/components/projects/ProjectProvider";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDownIcon, ClockIcon, HandIcon, ListTodoIcon, MessageSquareIcon } from "lucide-react";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { requestJson } from "@/lib/request-json";
import { cn } from "@/lib/utils";
import { CopyRef } from "./CopyRef";
import {
  ACTIVE_TASK_LIMIT,
  TASK_STAGES,
  shortDateTime,
  taskProgressLine,
  taskStageText,
  taskTypeLabel,
  type Agent,
  type Bid,
  type BidderStats,
  type Task,
  type TaskStatus,
} from "./task-model";
import {
  AgentFace,
  BackLink,
  TaskPageLoading,
  CardStack,
  ColorTab,
  EmptyCard,
  ITEM_CARD,
  LoadError,
  NotFoundState,
  STAGE_STYLES,
  type ItemStyle,
} from "./TaskParts";
import { useTasks } from "./TasksProvider";
import { OfferDialog } from "./OfferDialog";
import { TaskThread, threadMessages } from "./TaskThread";

const TABS = {
  bids: { icon: HandIcon, chip: "bg-accent text-primary-deep" },
  thread: { icon: MessageSquareIcon, chip: "bg-muted text-foreground" },
} satisfies Record<string, ItemStyle>;

const THREAD_REFRESH_MS = 20_000;

const BIDDABLE: TaskStatus[] = ["proposed", "open", "bidding", "reopened"];

type ApiBidderStats = {
  agent_id: string;
  agent_points_this_week: number;
  tasks_given_this_week: number;
  active_tasks: number;
};

/** This week's points, tasks given and workload per bidder, so whoever picks can see who is behind. */
function useBidderStats(agentIds: string[]) {
  const [stats, setStats] = useState<Record<string, BidderStats>>({});
  const key = [...new Set(agentIds)].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    requestJson<ApiBidderStats[]>(`/api/scoreboard/bidders?agent_ids=${encodeURIComponent(key)}`)
      .then((rows) => {
        if (cancelled) return;
        setStats(
          Object.fromEntries(
            rows.map((row) => [
              row.agent_id,
              {
                pointsThisWeek: row.agent_points_this_week,
                tasksGivenThisWeek: row.tasks_given_this_week,
                activeTasks: row.active_tasks,
              },
            ])
          )
        );
      })
      // The stats only help the decision; the bids still show without them.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key]);

  return stats;
}

/** The task's home: bidding and offers in one tab, the agents' conversation in the other. */
export function TaskView({ taskId }: { taskId: string }) {
  const {
    tasks,
    taskStatus,
    loadTask,
    threadFor,
    threadStatus,
    loadThread,
    currentUser,
    agentFor,
    bidsFor,
    sendOffer,
    withdrawOffer,
  } = useTasks();
  const { href, canManage } = useProject();
  const [offering, setOffering] = useState<Agent | null>(null);

  useEffect(() => loadTask(taskId), [taskId, loadTask]);
  useEffect(() => loadThread(taskId), [taskId, loadThread]);
  // Agents bid, accept offers, deliver and review while the page is open, so keep the task and thread current.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadThread(taskId);
      loadTask(taskId);
    }, THREAD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [taskId, loadThread, loadTask]);

  const task = tasks.find((candidate) => candidate.id === taskId);
  const tasksHref = href("/tasks");
  const bids = bidsFor(taskId);
  const bidderStats = useBidderStats(bids.map((bid) => bid.agentId));

  const state = taskStatus(taskId);
  if (!task && (state === undefined || state === "loading")) {
    return <TaskPageLoading />;
  }

  if (!task) {
    return (
      <NotFoundState
        title="Task not found"
        description="This task doesn't exist in this project, or it couldn't be loaded."
        icon={ListTodoIcon}
        backHref={tasksHref}
        backLabel="Back to tasks"
      />
    );
  }

  const isCreator = task.createdById === currentUser.id;
  const canOffer = isCreator || canManage;
  const thread = threadStatus(task.id);
  const worker = task.assignedAgentId ? agentFor(task.assignedAgentId) : undefined;
  const offeredTo = task.offer ? agentFor(task.offer.agentId) : undefined;
  const bidding = BIDDABLE.includes(task.status);
  const takingBids = bidding && !task.offer;
  const bidCount = thread === "ready" ? bids.length : task.bidCount;
  const threadCount = thread === "ready" ? threadMessages(threadFor(task.id)).length : task.commentCount - task.bidCount;
  const stage = TASK_STAGES.find((option) => option.statuses.includes(task.status)) ?? TASK_STAGES[0];
  const stageStyle = STAGE_STYLES[stage.value];
  const StageIcon = stageStyle.icon;
  const threadFailed = (
    <LoadError onRetry={() => loadThread(task.id)}>Couldn&rsquo;t load this task&rsquo;s comments.</LoadError>
  );
  const threadLoading = <Skeleton className="h-28 rounded-[22px]" aria-label="Loading comments" />;

  return (
    <>
      <BackLink href={tasksHref} label="Tasks" />
      <PageHeader
        title={task.title}
        actions={
          <CopyRef refText={task.ref} title={task.title} status={taskStageText(task.status)} labelled />
        }
        className="pt-2"
      />

      <PageContent>
        {task.description && <TaskDescription text={task.description} />}

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            <span className={cn("flex size-6 items-center justify-center rounded-full", stageStyle.chip)}>
              <StageIcon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="font-semibold text-foreground">{stage.label}</span>·
            <span>{taskProgressLine(task, { worker, offeredTo })}</span>
          </p>
          <p className="m-0 flex items-baseline gap-2">
            {task.points !== null && (
              <span className="text-2xl leading-none font-extrabold tracking-[-0.03em] text-primary-deep tabular-nums">
                {task.points} pts
              </span>
            )}
            <span className="text-[13px] text-muted-foreground">
              {taskTypeLabel(task.taskType)} · posted by {isCreator ? "you" : task.createdByName}
            </span>
          </p>
        </div>

        <Tabs key={task.id} defaultValue={bidding ? "bids" : "thread"} className="gap-4">
          <TabsList className="h-11! self-start p-1">
            <ColorTab
              value="bids"
              style={TABS.bids}
              label="Bids"
              count={bidCount}
              highlight={canOffer && takingBids && bidCount > 0}
            />
            <ColorTab value="thread" style={TABS.thread} label="Thread" count={threadCount} />
          </TabsList>

          <TabsContent value="bids" className="flex flex-col gap-4">
            {task.offer && (
              <OfferStatus
                task={task}
                agent={offeredTo}
                canWithdraw={canOffer}
                onWithdraw={() => withdrawOffer(task.id)}
              />
            )}
            <p className="m-0 text-[13px] text-muted-foreground">
              {!bidding
                ? `Bidding is closed${worker ? `. ${worker.name} took this task` : ""}.`
                : canOffer
                  ? "Pick the agent you want and send them an offer. They have 24 hours to accept."
                  : `Only ${task.createdByName} or project coordinators can send offers.`}
            </p>
            {thread === "error" ? (
              threadFailed
            ) : thread !== "ready" ? (
              threadLoading
            ) : bids.length === 0 ? (
              <EmptyCard>No bids yet. Agents who want this task bid on it, and their bids appear here.</EmptyCard>
            ) : (
              <CardStack>
                {bids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    agent={agentFor(bid.agentId)}
                    stats={bidderStats[bid.agentId]}
                    won={bid.agentId === task.assignedAgentId}
                    canOffer={canOffer && takingBids}
                    onOffer={setOffering}
                  />
                ))}
              </CardStack>
            )}
          </TabsContent>

          <TabsContent value="thread">
            {thread === "error" ? threadFailed : thread !== "ready" ? threadLoading : <TaskThread task={task} />}
          </TabsContent>
        </Tabs>
      </PageContent>

      <OfferDialog
        task={task}
        agent={offering}
        onOpenChange={(open) => !open && setOffering(null)}
        onConfirm={(agentId) => sendOffer(task.id, agentId)}
      />
    </>
  );
}

/** The brief at full width, so long text reads comfortably; past a few lines it folds behind "Show more". */
function TaskDescription({ text }: { text: string }) {
  const body = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <section aria-label="Task description" className="flex flex-col items-start gap-2 rounded-[22px] border border-border bg-card p-5 sm:p-6">
      <p
        ref={body}
        id="task-description"
        className={cn(
          "m-0 w-full text-[15px] leading-relaxed break-words whitespace-pre-line text-foreground/85",
          !expanded && "line-clamp-6"
        )}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          aria-expanded={expanded}
          aria-controls="task-description"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDownIcon data-icon="inline-end" aria-hidden="true" className={cn("transition-transform", expanded && "rotate-180")} />
        </Button>
      )}
    </section>
  );
}

function BidCard({
  bid,
  agent,
  stats,
  won,
  canOffer,
  onOffer,
}: {
  bid: Bid;
  agent?: Agent;
  stats?: BidderStats;
  won: boolean;
  canOffer: boolean;
  onOffer: (agent: Agent) => void;
}) {
  const atLimit = (stats?.activeTasks ?? 0) >= ACTIVE_TASK_LIMIT;
  const name = agent?.name ?? "Unknown agent";

  return (
    <li className={cn(ITEM_CARD, "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8")}>
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <AgentFace name={name} agent={agent} className="size-11 text-sm" />
        <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
          <p className="m-0 flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg leading-snug font-bold tracking-[-0.02em] text-foreground">{name}</span>
            {agent && (
              <span className="text-[13px] text-muted-foreground">
                {agent.speciality} · {agent.ownerName}
              </span>
            )}
          </p>
          <p className="m-0 max-w-[68ch] text-sm leading-relaxed text-foreground/85">{bid.message}</p>
          <p className="m-0 text-xs text-muted-foreground tabular-nums">
            {stats &&
              `${stats.pointsThisWeek} pts this week · ${stats.tasksGivenThisWeek} ${
                stats.tasksGivenThisWeek === 1 ? "task" : "tasks"
              } given this week · `}
            {agent && `active ${shortDateTime.format(new Date(agent.lastActiveAt))} · `}bid{" "}
            {shortDateTime.format(new Date(bid.createdAt))}
          </p>
        </div>
      </div>
      {won ? (
        <Badge variant="success" className="self-start">
          Took the task
        </Badge>
      ) : (
        canOffer &&
        agent && (
          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
            <Button variant="secondary" disabled={atLimit} onClick={() => onOffer(agent)}>
              Send offer
            </Button>
            {atLimit && <span className="text-xs text-muted-foreground">At the {ACTIVE_TASK_LIMIT}-task limit</span>}
          </div>
        )
      )}
    </li>
  );
}

function OfferStatus({
  task,
  agent,
  canWithdraw,
  onWithdraw,
}: {
  task: Task;
  agent?: Agent;
  canWithdraw: boolean;
  onWithdraw: () => Promise<void>;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!task.offer) return null;
  const name = agent?.name ?? "The agent";

  const withdraw = async () => {
    setWithdrawing(true);
    setError(null);
    try {
      await onWithdraw();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't withdraw the offer. Try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-primary/25 bg-accent p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ClockIcon className="mt-0.5 size-5 shrink-0 text-primary-deep" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="m-0 text-[15px] font-bold text-foreground">
              Waiting for {name}
              {agent && <span className="font-medium text-muted-foreground"> ({agent.ownerName})</span>}
            </p>
            <p className="m-0 text-sm text-accent-foreground">
              Offer expires {shortDateTime.format(new Date(task.offer.expiresAt))}. If {name} doesn&rsquo;t accept, the task
              goes back to bidding.
            </p>
          </div>
        </div>
        {canWithdraw && (
          <Button
            variant="outline"
            size="sm"
            className="self-start sm:self-center"
            onClick={() => void withdraw()}
            disabled={withdrawing}
          >
            {withdrawing && <Spinner data-icon="inline-start" />}
            Withdraw offer
          </Button>
        )}
      </div>
      {error && <p className="m-0 text-sm text-destructive">{error}</p>}
    </section>
  );
}
