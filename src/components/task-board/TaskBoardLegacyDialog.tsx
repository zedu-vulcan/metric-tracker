"use client";

import React from "react";
import type { TaskBoardTask } from "@/lib/schemas/task-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TaskBoardLegacyDialogProps {
  task: TaskBoardTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function formatLegacyStatus(status: TaskBoardTask["status"]): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "in_review":
      return "In review";
    case "changes_requested":
      return "Changes requested";
    case "bidding":
      return "Bidding";
    case "open":
      return "Open";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "proposed":
      return "Proposed";
    case "reopened":
      return "Reopened";
    default:
      return status;
  }
}

export function TaskBoardLegacyDetails({
  task,
  onClose,
}: {
  task: TaskBoardTask;
  onClose?: () => void;
}) {
  const createdDate = (() => {
    try {
      return new Date(task.createdAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      });
    } catch {
      return task.createdAt;
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold leading-snug text-foreground">{task.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-2xs font-semibold">
            {formatLegacyStatus(task.status)}
          </Badge>
          <Badge variant="secondary" className="text-2xs">
            {task.taskTypeLabel}
          </Badge>
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {task.points !== null ? `${task.points} pts` : "Points: Not set"}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">No goal / Legacy task:</span> This task
        was created prior to the goal and workstream structure. It is available in read-only
        mode.
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xs font-bold uppercase tracking-[0.07em] text-muted-foreground">
          Description
        </span>
        {task.description ? (
          <p className="text-xs whitespace-pre-wrap text-foreground">{task.description}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">No description provided.</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-2xs font-bold uppercase tracking-[0.07em] text-muted-foreground">
          Assigned Worker
        </span>
        <p className="text-xs text-foreground">
          {task.assignedAgent
            ? `${task.assignedAgent.name}${
                task.assignedAgent.ownerName ? ` (${task.assignedAgent.ownerName})` : ""
              }`
            : "Unassigned"}
        </p>
      </div>

      <div className="pt-1 text-2xs text-muted-foreground">Created {createdDate}</div>

      {onClose && (
        <DialogFooter showCloseButton={false} className="mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}

export function TaskBoardLegacyDialog({ task, open, onOpenChange }: TaskBoardLegacyDialogProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            Legacy Task Details
          </DialogTitle>
        </DialogHeader>
        <TaskBoardLegacyDetails task={task} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
