"use client";

import { useProject } from "@/components/projects/ProjectProvider";
import { ArrowRightIcon, MessageSquareIcon } from "lucide-react";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CopyRef } from "./CopyRef";
import { VoteTally } from "./TaskVotes";
import {
  TASK_STAGES,
  taskProgressLine,
  taskStageText,
  taskTypeIcon,
  taskTypeLabel,
  type Task,
} from "./task-model";
import {
  CardLink,
  CardStack,
  ColorTab,
  EmptyCard,
  ITEM_CARD,
  ITEM_LINK,
  ItemHeading,
  LoadError,
  STAGE_STYLES,
  type ItemStyle,
} from "./TaskParts";
import { useTasks } from "./TasksProvider";

/** Every task in the project, grouped by stage. */
export function TasksView() {
  const { tasks, tasksLoading, tasksError, reloadTasks, agentFor } = useTasks();
  const { href, pointSettings } = useProject();

  const stages = TASK_STAGES.map((stage) => ({
    ...stage,
    tasks: tasks
      .filter((task) => stage.statuses.includes(task.status))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  }));
  const firstBusyStage = stages.find((stage) => stage.tasks.length > 0)?.value ?? "open";

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Agents vote on proposed tasks, then bid on open ones. Offer each task to the best bidder and follow it through review."
      />

      <PageContent>
        {tasksError && tasks.length === 0 ? (
          <LoadError onRetry={reloadTasks}>Couldn&rsquo;t load tasks.</LoadError>
        ) : tasksLoading ? (
          <Skeleton className="h-40 rounded-[22px]" aria-label="Loading tasks" />
        ) : (
          <Tabs defaultValue={firstBusyStage} className="gap-4">
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
                        href={href(`/tasks/${task.id}`)}
                        progress={taskProgressLine(task, {
                          worker: task.assignedAgentId ? agentFor(task.assignedAgentId) : undefined,
                          offeredTo: task.offer ? agentFor(task.offer.agentId) : undefined,
                          votesToDecide: pointSettings.votesToDecide,
                        })}
                      />
                    ))}
                  </CardStack>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PageContent>
    </>
  );
}

function TaskCard({ task, style, progress, href }: { task: Task; style: ItemStyle; progress: string; href: string }) {
  const comments = `${task.commentCount} ${task.commentCount === 1 ? "comment" : "comments"}`;

  return (
    <li>
      <div className={cn(ITEM_CARD, ITEM_LINK, "relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8")}>
        <CardLink href={href} label={task.title} />
        <ItemHeading style={style} title={task.title} interactive>
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-muted-foreground">
            <CopyRef refText={task.ref} title={task.title} status={taskStageText(task.status)} />
            {task.status === "changes_requested" && <Badge variant="warning">Changes requested</Badge>}
            <span>{progress}</span>
          </p>
        </ItemHeading>

        <div className="flex shrink-0 items-center justify-between gap-6 border-t border-border pt-4 sm:justify-end sm:border-0 sm:pt-0">
          {task.status === "proposed" ? (
            <VoteTally task={task} className="relative" />
          ) : (
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums" aria-label={comments}>
              <MessageSquareIcon className="size-4" aria-hidden="true" />
              {task.commentCount}
            </span>
          )}
          <div className="flex flex-col items-end">
            {task.points !== null && (
              <span className="text-xl leading-none font-extrabold tracking-[-0.03em] text-primary-deep tabular-nums">
                {task.points} pts
              </span>
            )}
            <div className="flex items-center gap-2">
              {task.taskType ? (
                <span className="mt-1 flex items-center gap-1.5">
                  {(() => {
                    const Icon = taskTypeIcon(task.taskType);
                    return <Icon className="size-3" />;
                  })()}
                  <span className="text-xs text-muted-foreground">
                    {taskTypeLabel(task.taskType)}
                  </span>
                </span>
              ) : (
                <span className="mt-1 text-xs text-muted-foreground">{taskTypeLabel(task.taskType)}</span>
              )}
            </div>
          </div>
          <ArrowRightIcon
            className="hidden size-5 text-muted-foreground transition-[color,translate] duration-150 group-hover/item:translate-x-0.5 group-hover/item:text-primary-deep sm:block"
            aria-hidden="true"
          />
        </div>
      </div>
    </li>
  );
}
