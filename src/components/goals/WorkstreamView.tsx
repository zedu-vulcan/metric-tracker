"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRightIcon, FolderTreeIcon, LayersIcon, MessageSquareIcon } from "lucide-react";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TASK_STAGES, shortDate, summarizeTasks, taskProgressLine, type Task } from "./goal-model";
import {
  BackLink,
  CardStack,
  ColorTab,
  EmptyCard,
  ITEM_CARD,
  ITEM_LINK,
  ItemHeading,
  NotFoundState,
  STAGE_STYLES,
  TaskProgress,
  type ItemStyle,
} from "./GoalParts";
import { useGoals } from "./GoalsProvider";

export function WorkstreamView({ goalId, workstreamId }: { goalId: string; workstreamId: string }) {
  const { goals, ideas, tasks, currentUser, agentFor, bidsFor } = useGoals();

  const goal = goals.find((candidate) => candidate.id === goalId);
  const workstream = ideas.find(
    (idea) => idea.id === workstreamId && idea.goalId === goalId && idea.status === "accepted"
  );
  const workstreamTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.workstreamId === workstreamId)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [tasks, workstreamId]
  );

  if (!goal || !workstream) {
    return (
      <NotFoundState
        title="Workstream not found"
        description="This workstream doesn't exist, or its idea hasn't been approved yet."
        icon={FolderTreeIcon}
        backHref={goal ? `/dashboard/goals/${goal.id}` : "/dashboard/goals"}
        backLabel={goal ? `Back to ${goal.title}` : "Back to goals"}
      />
    );
  }

  const stages = TASK_STAGES.map((stage) => ({
    ...stage,
    tasks: workstreamTasks.filter((task) => stage.statuses.includes(task.status)),
  }));
  const firstBusyStage = stages.find((stage) => stage.tasks.length > 0)?.value ?? "open";
  const ideaAgent = agentFor(workstream.agentId);
  const summary = summarizeTasks(workstreamTasks);

  return (
    <>
      <BackLink href={`/dashboard/goals/${goal.id}`} label={goal.title} />
      <PageHeader title={workstream.title} description={workstream.description || undefined} className="pt-2" />

      <PageContent>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-primary-deep">
              <LayersIcon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="font-semibold text-foreground">Workstream</span>·
            <span>
              proposed by <span className="font-semibold text-foreground">{ideaAgent?.name ?? "an agent"}</span>
            </span>
            {workstream.decidedAt && (
              <>
                ·
                <span>
                  approved by {workstream.decidedBy === currentUser.name ? "you" : workstream.decidedBy} on{" "}
                  {shortDate.format(new Date(workstream.decidedAt))}
                </span>
              </>
            )}
          </p>
          <div className="w-full lg:max-w-md">
            <TaskProgress label={workstream.title} done={summary.approvedTasks} total={summary.totalTasks} />
          </div>
        </div>

        <Tabs key={workstream.id} defaultValue={firstBusyStage} className="gap-4">
          <TabsList className="h-11! max-w-full justify-start self-start overflow-x-auto p-1">
            {stages.map((stage) => (
              <ColorTab
                key={stage.value}
                value={stage.value}
                style={STAGE_STYLES[stage.value]}
                label={stage.label}
                count={stage.tasks.length}
                highlight={stage.value === "in_review" && stage.tasks.length > 0}
              />
            ))}
          </TabsList>

          {stages.map((stage) => (
            <TabsContent key={stage.value} value={stage.value}>
              {stage.tasks.length === 0 ? (
                <EmptyCard>{STAGE_STYLES[stage.value].empty}</EmptyCard>
              ) : (
                <CardStack>
                  {stage.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      style={STAGE_STYLES[stage.value]}
                      href={`/dashboard/goals/${goal.id}/workstreams/${workstream.id}/tasks/${task.id}`}
                      progress={taskProgressLine(task, {
                        worker: task.assignedAgentId ? agentFor(task.assignedAgentId) : undefined,
                        offeredTo: task.offer ? agentFor(task.offer.agentId) : undefined,
                        bidCount: bidsFor(task.id).length,
                      })}
                    />
                  ))}
                </CardStack>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </PageContent>
    </>
  );
}

function TaskCard({ task, style, progress, href }: { task: Task; style: ItemStyle; progress: string; href: string }) {
  const comments = `${task.commentCount} ${task.commentCount === 1 ? "comment" : "comments"}`;

  return (
    <li>
      <Link
        href={href}
        className={cn(ITEM_CARD, ITEM_LINK, "flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8")}
      >
        <ItemHeading style={style} title={task.title} interactive>
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-muted-foreground">
            {task.status === "changes_requested" && <Badge variant="warning">Changes requested</Badge>}
            <span>{progress}</span>
          </p>
        </ItemHeading>

        <div className="flex shrink-0 items-center justify-between gap-6 border-t border-border pt-4 sm:justify-end sm:border-0 sm:pt-0">
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums" aria-label={comments}>
            <MessageSquareIcon className="size-4" aria-hidden="true" />
            {task.commentCount}
          </span>
          <div className="flex flex-col items-end">
            <span className="text-xl leading-none font-extrabold tracking-[-0.03em] text-primary-deep tabular-nums">
              {task.points} pts
            </span>
            <span className="mt-1 text-xs text-muted-foreground">{task.taskType}</span>
          </div>
          <ArrowRightIcon
            className="hidden size-5 text-muted-foreground transition-[color,translate] duration-150 group-hover/item:translate-x-0.5 group-hover/item:text-primary-deep sm:block"
            aria-hidden="true"
          />
        </div>
      </Link>
    </li>
  );
}
