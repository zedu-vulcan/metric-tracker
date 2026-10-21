"use client";

import { useState } from "react";
import { ClockIcon, HandIcon, ListTodoIcon, MessageSquareIcon } from "lucide-react";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ACTIVE_TASK_LIMIT,
  TASK_STAGES,
  agentStats,
  shortDateTime,
  taskProgressLine,
  type Agent,
  type Bid,
  type Task,
} from "./goal-model";
import {
  BackLink,
  CardStack,
  ColorTab,
  EmptyCard,
  ITEM_CARD,
  NotFoundState,
  STAGE_STYLES,
  type ItemStyle,
} from "./GoalParts";
import { useGoals } from "./GoalsProvider";
import { OfferDialog } from "./OfferDialog";
import { TaskThread, agentMessages } from "./TaskThread";

const TABS = {
  bids: { icon: HandIcon, chip: "bg-accent text-primary-deep" },
  thread: { icon: MessageSquareIcon, chip: "bg-muted text-foreground" },
} satisfies Record<string, ItemStyle>;

/** The task's home: bidding and offers in one tab, the agents' conversation in the other. */
export function TaskView({ goalId, workstreamId, taskId }: { goalId: string; workstreamId: string; taskId: string }) {
  const { goals, ideas, tasks, currentUser, agentFor, bidsFor, threadFor, sendOffer, withdrawOffer, acceptOffer, expireOffer } =
    useGoals();
  const [offering, setOffering] = useState<Agent | null>(null);

  const goal = goals.find((candidate) => candidate.id === goalId);
  const workstream = ideas.find((idea) => idea.id === workstreamId && idea.goalId === goalId);
  const task = tasks.find((candidate) => candidate.id === taskId && candidate.workstreamId === workstreamId);
  const workstreamHref = `/dashboard/goals/${goalId}/workstreams/${workstreamId}`;

  if (!goal || !workstream || !task) {
    return (
      <NotFoundState
        title="Task not found"
        description="This task doesn't exist in this workstream."
        icon={ListTodoIcon}
        backHref={workstream ? workstreamHref : `/dashboard/goals/${goalId}`}
        backLabel={workstream ? `Back to ${workstream.title}` : "Back to goal"}
      />
    );
  }

  const isOwner = goal.ownerId === currentUser.id;
  const bids = bidsFor(task.id);
  const worker = task.assignedAgentId ? agentFor(task.assignedAgentId) : undefined;
  const offeredTo = task.offer ? agentFor(task.offer.agentId) : undefined;
  const bidding = task.status === "open" || task.status === "bidding";
  const takingBids = bidding && !task.offer;
  const threadCount = agentMessages(threadFor(task.id)).length;
  const stage = TASK_STAGES.find((option) => option.statuses.includes(task.status)) ?? TASK_STAGES[0];
  const stageStyle = STAGE_STYLES[stage.value];
  const StageIcon = stageStyle.icon;

  return (
    <>
      <BackLink href={workstreamHref} label={workstream.title} />
      <PageHeader title={task.title} description={task.description || undefined} className="pt-2" />

      <PageContent>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            <span className={cn("flex size-6 items-center justify-center rounded-full", stageStyle.chip)}>
              <StageIcon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="font-semibold text-foreground">{stage.label}</span>·
            <span>{taskProgressLine(task, { worker, offeredTo, bidCount: bids.length })}</span>
          </p>
          <p className="m-0 flex items-baseline gap-2">
            <span className="text-2xl leading-none font-extrabold tracking-[-0.03em] text-primary-deep tabular-nums">
              {task.points} pts
            </span>
            <span className="text-[13px] text-muted-foreground">{task.taskType}</span>
          </p>
        </div>

        <Tabs key={task.id} defaultValue={bidding ? "bids" : "thread"} className="gap-4">
          <TabsList className="h-11! self-start p-1">
            <ColorTab
              value="bids"
              style={TABS.bids}
              label="Bids"
              count={bids.length}
              highlight={isOwner && takingBids && bids.length > 0}
            />
            <ColorTab value="thread" style={TABS.thread} label="Thread" count={threadCount} />
          </TabsList>

          <TabsContent value="bids" className="flex flex-col gap-4">
            {task.offer && (
              <OfferStatus
                task={task}
                agent={offeredTo}
                canWithdraw={isOwner}
                onWithdraw={() => withdrawOffer(task.id)}
                onAccept={() => acceptOffer(task.id)}
                onExpire={() => expireOffer(task.id)}
              />
            )}
            <p className="m-0 text-[13px] text-muted-foreground">
              {!bidding
                ? `Bidding is closed${worker ? `. ${worker.name} took this task` : ""}.`
                : isOwner
                  ? "Pick the agent you want and send them an offer. They have 24 hours to accept."
                  : `Only ${goal.ownerName} can send offers.`}
            </p>
            {bids.length === 0 ? (
              <EmptyCard>No bids yet. Agents who want this task bid on it, and their bids appear here.</EmptyCard>
            ) : (
              <CardStack>
                {bids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    agent={agentFor(bid.agentId)}
                    tasks={tasks}
                    won={bid.agentId === task.assignedAgentId}
                    canOffer={isOwner && takingBids}
                    onOffer={setOffering}
                  />
                ))}
              </CardStack>
            )}
          </TabsContent>

          <TabsContent value="thread">
            <TaskThread task={task} />
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function BidCard({
  bid,
  agent,
  tasks,
  won,
  canOffer,
  onOffer,
}: {
  bid: Bid;
  agent?: Agent;
  tasks: Task[];
  won: boolean;
  canOffer: boolean;
  onOffer: (agent: Agent) => void;
}) {
  const stats = agentStats(bid.agentId, tasks);
  const atLimit = stats.activeTasks >= ACTIVE_TASK_LIMIT;
  const name = agent?.name ?? "Unknown agent";

  return (
    <li className={cn(ITEM_CARD, "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8")}>
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-primary-deep"
          aria-hidden="true"
        >
          {initials(name) || "?"}
        </span>
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
            {stats.pointsThisWeek} pts this week · {stats.tasksGiven} {stats.tasksGiven === 1 ? "task" : "tasks"} given
            {agent && ` · active ${shortDateTime.format(new Date(agent.lastActiveAt))}`} · bid{" "}
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
  onAccept,
  onExpire,
}: {
  task: Task;
  agent?: Agent;
  canWithdraw: boolean;
  onWithdraw: () => void;
  onAccept: () => void;
  onExpire: () => void;
}) {
  if (!task.offer) return null;
  const name = agent?.name ?? "The agent";

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
          <Button variant="outline" size="sm" className="self-start sm:self-center" onClick={onWithdraw}>
            Withdraw offer
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-primary/25 pt-3">
        <span className="text-2xs font-bold tracking-[0.07em] text-accent-foreground uppercase">Demo</span>
        <Button variant="ghost" size="xs" onClick={onAccept}>
          {name} accepts
        </Button>
        <Button variant="ghost" size="xs" onClick={onExpire}>
          Offer expires
        </Button>
      </div>
    </section>
  );
}
