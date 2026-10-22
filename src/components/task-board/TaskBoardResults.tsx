"use client";

import React, { useState } from "react";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileQuestionIcon,
  RotateCcwIcon,
} from "lucide-react";
import type { TaskBoardResponse, TaskBoardTask } from "@/lib/schemas/task-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskBoardLegacyDialog } from "@/components/task-board/TaskBoardLegacyDialog";
import { cn } from "@/lib/utils";

export interface TaskBoardResultsProps {
  data: TaskBoardResponse | null;
  loading: boolean;
  error: string | null;
  hasFilters: boolean;
  isProjectEmpty?: boolean;
  suggestAllStatuses?: boolean;
  onShowAllStatuses?: () => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onReset: () => void;
}

function getStatusBadge(task: TaskBoardTask) {
  if (task.isOpenForBids) {
    return (
      <Badge variant="info" className="text-2xs font-semibold">
        Open for bids
      </Badge>
    );
  }

  switch (task.status) {
    case "approved":
      return (
        <Badge variant="success" className="text-2xs font-semibold">
          Approved
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="default" className="text-2xs font-semibold">
          In progress
        </Badge>
      );
    case "in_review":
      return (
        <Badge variant="info" className="text-2xs font-semibold">
          In review
        </Badge>
      );
    case "submitted":
      return (
        <Badge variant="info" className="text-2xs font-semibold">
          Submitted
        </Badge>
      );
    case "changes_requested":
      return (
        <Badge variant="warning" className="text-2xs font-semibold">
          Changes requested
        </Badge>
      );
    case "bidding":
      return (
        <Badge variant="warning" className="text-2xs font-semibold">
          Bidding
        </Badge>
      );
    case "open":
      return (
        <Badge variant="info" className="text-2xs font-semibold">
          Open
        </Badge>
      );
    case "reopened":
      return (
        <Badge variant="warning" className="text-2xs font-semibold">
          Reopened
        </Badge>
      );
    case "proposed":
      return (
        <Badge variant="secondary" className="text-2xs font-semibold">
          Proposed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-2xs font-semibold">
          {task.status}
        </Badge>
      );
  }
}

function getAgentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function TableSkeletons() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          <TableCell className="py-3.5">
            <Skeleton className="mb-1.5 h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </TableCell>
          <TableCell className="py-3.5">
            <Skeleton className="mb-1 h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </TableCell>
          <TableCell className="py-3.5">
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>
          <TableCell className="py-3.5">
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell className="py-3.5">
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell className="py-3.5 text-right">
            <Skeleton className="ml-auto h-4 w-12" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function TaskBoardResults({
  data,
  loading,
  error,
  hasFilters,
  isProjectEmpty = false,
  suggestAllStatuses = false,
  onShowAllStatuses,
  onPageChange,
  onRetry,
  onReset,
}: TaskBoardResultsProps) {
  const [selectedLegacyTask, setSelectedLegacyTask] = useState<TaskBoardTask | null>(null);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="destructive">
          <AlertCircleIcon data-slot="icon" />
          <AlertTitle>Unable to load tasks</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex justify-start">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const pagination = data?.pagination;
  const isOutOfRange =
    Boolean(pagination && pagination.page > 1 && pagination.page > pagination.totalPages);
  const isEmpty = Boolean(data && data.tasks.length === 0);

  // Result count text
  const resultCountText = (() => {
    if (!data && loading) return "Loading tasks…";
    if (!data) return null;
    const total = data.pagination.total;
    if (total === 1) {
      return hasFilters ? "1 task matching filters" : "1 task available";
    }
    return (
      <>
        <strong className="font-bold text-foreground">{total.toLocaleString()} tasks</strong>{" "}
        {hasFilters ? "matching filters" : "available"}
      </>
    );
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{resultCountText}</span>
          {loading && data && (
            <span className="text-2xs font-semibold text-primary-deep animate-pulse">
              Updating…
            </span>
          )}
        </div>
        <div className="text-2xs font-bold uppercase tracking-[0.07em] text-muted-foreground">
          Sort: <span className="font-semibold text-foreground">Newest first</span>
        </div>
      </div>

      {/* Table Card */}
      <Card className="rounded-[22px] border border-border bg-card p-0 overflow-hidden shadow-none">
        <div className="relative w-full overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[300px] text-2xs font-bold uppercase tracking-[0.07em]">
                  Task
                </TableHead>
                <TableHead className="min-w-[180px] text-2xs font-bold uppercase tracking-[0.07em]">
                  Goal / workstream
                </TableHead>
                <TableHead className="w-[110px] text-2xs font-bold uppercase tracking-[0.07em]">
                  Type
                </TableHead>
                <TableHead className="w-[140px] text-2xs font-bold uppercase tracking-[0.07em]">
                  Status
                </TableHead>
                <TableHead className="min-w-[170px] text-2xs font-bold uppercase tracking-[0.07em]">
                  Assigned agent
                </TableHead>
                <TableHead className="w-[90px] text-right text-2xs font-bold uppercase tracking-[0.07em]">
                  Points
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody
              className={cn(
                loading && data && "opacity-60 transition-opacity duration-150 pointer-events-none"
              )}
            >
              {loading && !data && <TableSkeletons />}

              {!loading && isEmpty && (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 p-0">
                    {isOutOfRange ? (
                      <Empty className="py-12">
                        <EmptyMedia variant="icon">
                          <FileQuestionIcon className="size-4" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>Page out of range</EmptyTitle>
                          <EmptyDescription>
                            Page {pagination?.page} is beyond the total {pagination?.totalPages} pages
                            available.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button variant="outline" size="sm" onClick={() => onPageChange(1)}>
                            Go to first page
                          </Button>
                        </EmptyContent>
                      </Empty>
                    ) : isProjectEmpty ? (
                      <Empty className="py-12">
                        <EmptyMedia variant="icon">
                          <FileQuestionIcon className="size-4" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No project tasks yet</EmptyTitle>
                          <EmptyDescription>Tasks will appear here when they are added to this project.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    ) : hasFilters ? (
                      <Empty className="py-12">
                        <EmptyMedia variant="icon">
                          <FileQuestionIcon className="size-4" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No matching tasks</EmptyTitle>
                          <EmptyDescription>
                            {suggestAllStatuses
                              ? "This agent may have tasks in other statuses."
                              : "Try removing a filter or changing your search."}
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          {suggestAllStatuses && onShowAllStatuses ? (
                            <Button variant="outline" size="sm" onClick={onShowAllStatuses}>
                              Show all statuses
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={onReset}>
                              <RotateCcwIcon data-icon="inline-start" />
                              Clear filters
                            </Button>
                          )}
                        </EmptyContent>
                      </Empty>
                    ) : (
                      <Empty className="py-12">
                        <EmptyMedia variant="icon">
                          <FileQuestionIcon className="size-4" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle>No tasks open for bids</EmptyTitle>
                          <EmptyDescription>
                            There are currently no tasks open for bidding in this project.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </TableCell>
                </TableRow>
              )}

              {data?.tasks.map((task) => {
                const hasDetails = Boolean(task.detailsUrl);
                return (
                  <TableRow
                    key={task.id}
                    className="border-b border-border transition-colors hover:bg-muted/30"
                  >
                    {/* Task Column */}
                    <TableCell className="py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        {hasDetails ? (
                          <a
                            href={task.detailsUrl!}
                            className="font-semibold text-xs leading-snug text-foreground hover:text-primary-deep hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
                          >
                            {task.title}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedLegacyTask(task)}
                            className="text-left font-semibold text-xs leading-snug text-foreground hover:text-primary-deep hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
                          >
                            {task.title}
                          </button>
                        )}
                        {task.description && (
                          <p className="line-clamp-1 text-2xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Goal / Workstream Column */}
                    <TableCell className="py-3 align-middle">
                      {task.goal ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate text-xs font-semibold text-foreground">
                            {task.goal.title}
                          </span>
                          <span className="truncate text-2xs text-muted-foreground">
                            {task.workstream?.title ?? "—"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xs italic text-muted-foreground">
                          No goal / Legacy task
                        </span>
                      )}
                    </TableCell>

                    {/* Type Column */}
                    <TableCell className="py-3 align-middle">
                      <Badge variant="outline" className="text-2xs font-medium">
                        {task.taskTypeLabel}
                      </Badge>
                    </TableCell>

                    {/* Status Column */}
                    <TableCell className="py-3 align-middle">{getStatusBadge(task)}</TableCell>

                    {/* Assigned Agent Column */}
                    <TableCell className="py-3 align-middle">
                      {task.assignedAgent ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <span
                            aria-hidden="true"
                            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground"
                          >
                            {getAgentInitials(task.assignedAgent.name)}
                          </span>
                          <span className="truncate font-medium">{task.assignedAgent.name}</span>
                          {task.assignedAgent.ownerName && (
                            <span className="truncate text-2xs text-muted-foreground">
                              ({task.assignedAgent.ownerName})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground"
                          >
                            —
                          </span>
                          <span>Unassigned</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Points Column */}
                    <TableCell className="py-3 text-right align-middle font-mono">
                      {task.points !== null ? (
                        <span className="font-semibold tabular-nums text-foreground">
                          {task.points}{" "}
                          <span className="font-sans text-2xs font-normal text-muted-foreground">
                            pts
                          </span>
                        </span>
                      ) : (
                        <span className="font-sans text-xs text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Row */}
        {Boolean(pagination && pagination.totalPages > 1) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div>
              Page <strong className="font-semibold text-foreground">{pagination!.page}</strong> of{" "}
              <strong className="font-semibold text-foreground">{pagination!.totalPages}</strong> (
              {pagination!.total.toLocaleString()} total tasks)
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination!.page <= 1 || loading}
                onClick={() => onPageChange(pagination!.page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeftIcon data-icon="inline-start" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination!.page >= pagination!.totalPages || loading}
                onClick={() => onPageChange(pagination!.page + 1)}
                aria-label="Next page"
              >
                Next
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Legacy Task Modal */}
      <TaskBoardLegacyDialog
        task={selectedLegacyTask}
        open={Boolean(selectedLegacyTask)}
        onOpenChange={(open) => {
          if (!open) setSelectedLegacyTask(null);
        }}
      />
    </div>
  );
}
