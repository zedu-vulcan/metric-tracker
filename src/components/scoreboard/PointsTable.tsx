"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ScoreboardBreakdown, ScoreboardRow } from "@/lib/schemas/scoreboard";

function formatPoints(points: number): string {
  return points.toLocaleString("en-GB");
}

function BreakdownLine({ breakdown }: { breakdown: ScoreboardBreakdown }) {
  const items = [
    { label: "Tasks", value: breakdown.tasks },
    { label: "Reviews", value: breakdown.reviews },
    { label: "Ideas", value: breakdown.ideas },
    { label: "Adjustments", value: breakdown.adjustments },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          {item.label}
          <span className={cn("font-semibold tabular-nums", item.value < 0 ? "text-destructive" : "text-foreground")}>
            {item.value > 0 ? "+" : ""}
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function ProgressBar({ row, target }: { row: ScoreboardRow; target: number }) {
  return (
    <div className="flex min-w-[140px] items-center gap-3">
      <div
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-chart-track"
        role="progressbar"
        aria-label={`${row.name}: ${row.points} of ${target} points`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={row.progress_pct}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${row.progress_pct}%` }} />
      </div>
      <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">
        {formatPoints(row.points)}
        <span className="text-muted-foreground">/{target}</span>
      </span>
    </div>
  );
}

function AgentChips({ row }: { row: ScoreboardRow }) {
  const shown = row.agents.slice(0, 2);
  const extra = row.agents.length - shown.length;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {shown.map((agent) => (
        <Badge key={agent.id} variant="secondary" className="max-w-[160px]">
          <span className="truncate">{agent.name}</span>
          <span className="text-muted-foreground tabular-nums">· {agent.points}</span>
        </Badge>
      ))}
      {extra > 0 && <span className="text-xs text-muted-foreground">+{extra} more</span>}
    </div>
  );
}

export function PointsTable({
  rows,
  target,
  currentUserId,
}: {
  rows: ScoreboardRow[];
  target: number;
  currentUserId: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden sm:block">
        <Table variant="pill">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="w-[220px]">Progress</TableHead>
              <TableHead className="w-24 text-right">Points</TableHead>
              <TableHead className="w-24 text-right">Tasks</TableHead>
              <TableHead className="w-10" aria-label="Details" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const expanded = expandedId === row.user_id;
              return (
                <TableRowFragment
                  key={row.user_id}
                  row={row}
                  target={target}
                  currentUserId={currentUserId}
                  expanded={expanded}
                  onToggle={() => toggle(row.user_id)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="m-0 flex list-none flex-col divide-y divide-border p-0 sm:hidden">
        {rows.map((row) => {
          const expanded = expandedId === row.user_id;
          const current = row.user_id === currentUserId;
          return (
            <li key={row.user_id} className={cn("flex flex-col gap-2 py-3", current && "rounded-xl bg-accent px-2")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                    {row.rank}
                  </span>
                  <span className="truncate text-sm font-bold text-foreground">{row.name}</span>
                  {current && <Badge variant="default">You</Badge>}
                </div>
                <span className="shrink-0 text-sm font-extrabold text-foreground tabular-nums">{formatPoints(row.points)}</span>
              </div>
              <div className="pl-7">
                <ProgressBar row={row} target={target} />
              </div>
              <div className="flex items-center justify-between pl-7">
                <AgentChips row={row} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${expanded ? "Hide" : "Show"} breakdown for ${row.name}`}
                  aria-expanded={expanded}
                  onClick={() => toggle(row.user_id)}
                >
                  <ChevronDownIcon className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                </Button>
              </div>
              {expanded && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <BreakdownLine breakdown={row.breakdown} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.tasks_given_this_week} task{row.tasks_given_this_week === 1 ? "" : "s"} given this week
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TableRowFragment({
  row,
  target,
  currentUserId,
  expanded,
  onToggle,
}: {
  row: ScoreboardRow;
  target: number;
  currentUserId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const current = row.user_id === currentUserId;
  return (
    <>
      <TableRow data-state={current ? "selected" : undefined}>
        <TableCell className="text-muted-foreground tabular-nums">{row.rank}</TableCell>
        <TableCell className="max-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("truncate font-semibold text-foreground", current && "text-primary-deep")}>{row.name}</span>
            {current && <Badge variant="default">You</Badge>}
          </div>
          <AgentChips row={row} />
        </TableCell>
        <TableCell>
          <ProgressBar row={row} target={target} />
        </TableCell>
        <TableCell className="text-right text-sm font-extrabold text-foreground tabular-nums">{formatPoints(row.points)}</TableCell>
        <TableCell className="text-right text-muted-foreground tabular-nums">{row.tasks_given_this_week}</TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${expanded ? "Hide" : "Show"} breakdown for ${row.name}`}
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <ChevronDownIcon className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow data-state={current ? "selected" : undefined}>
          <TableCell />
          <TableCell colSpan={4} className="py-2">
            <BreakdownLine breakdown={row.breakdown} />
          </TableCell>
          <TableCell />
        </TableRow>
      )}
    </>
  );
}
