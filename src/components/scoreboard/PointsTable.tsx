"use client";

import { Fragment, useState } from "react";
import { ChevronDownIcon, TrophyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ScoreboardBreakdown, ScoreboardRow } from "@/lib/schemas/scoreboard";
import { cn } from "@/lib/utils";

export const formatPoints = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 1 });

const BREAKDOWN: { key: keyof ScoreboardBreakdown; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "reviews", label: "Reviews" },
  { key: "ideas", label: "Ideas" },
  { key: "adjustments", label: "Adjustments" },
];

function Breakdown({ row }: { row: ScoreboardRow }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted px-4 py-3">
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {BREAKDOWN.map(({ key, label }) => {
          const value = row.breakdown[key];
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn("m-0 text-sm font-bold tabular-nums", value < 0 ? "text-destructive" : "text-foreground")}>
                {value > 0 ? "+" : value < 0 ? "−" : ""}
                {formatPoints(Math.abs(value))}
              </dd>
            </div>
          );
        })}
      </dl>
      {row.agents.length > 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          Agents:{" "}
          {row.agents
            .map((agent) => `${agent.name} ${formatPoints(agent.points)}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function TargetBar({ row, target }: { row: ScoreboardRow; target: number }) {
  const percent = Math.min(100, Math.round((row.points / Math.max(1, target)) * 100));
  const reached = row.points >= target;
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={`${row.name}: ${formatPoints(row.points)} of ${target} points`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={row.points}
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-chart-track"
      >
        <div className={cn("h-full rounded-full", reached ? "bg-success" : "bg-primary")} style={{ width: `${percent}%` }} />
      </div>
      <span className={cn("w-10 shrink-0 text-right text-xs font-semibold tabular-nums", reached ? "text-success" : "text-muted-foreground")}>
        {percent}%
      </span>
    </div>
  );
}

/** Everyone ranked for the chosen period; open a row to see where its points came from. */
export function PointsTable({
  rows,
  target,
  currentUserId,
}: {
  rows: ScoreboardRow[];
  /** Null for all-time, where there's no target to measure against. */
  target: number | null;
  currentUserId: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));

  if (rows.length === 0) {
    return (
      <Empty className="border-0 py-10">
        <EmptyHeader>
          <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
            <TrophyIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-[15px] font-bold">No points in this period</EmptyTitle>
          <EmptyDescription>Points show up here once work is approved or reviewed.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table variant="pill">
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">Rank</TableHead>
          <TableHead>Person</TableHead>
          {target !== null && <TableHead className="hidden w-[34%] md:table-cell">Toward {target}</TableHead>}
          <TableHead className="text-right">Points</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Breakdown</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const you = row.user_id === currentUserId;
          const expanded = open === row.user_id;
          return (
            <Fragment key={row.user_id}>
              <TableRow data-state={you ? "selected" : undefined}>
                <TableCell>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-[13px] font-extrabold tabular-nums",
                      row.rank === 1 && row.points > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {row.rank}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex w-[150px] flex-col sm:w-[260px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{row.name}</span>
                      {you && <Badge className="shrink-0">You</Badge>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.agents.length === 0
                        ? "No agents yet"
                        : `${row.agents.length} ${row.agents.length === 1 ? "agent" : "agents"}`}
                    </span>
                  </div>
                </TableCell>
                {target !== null && (
                  <TableCell className="hidden md:table-cell">
                    <TargetBar row={row} target={target} />
                  </TableCell>
                )}
                <TableCell className="text-right text-base font-extrabold tracking-[-0.02em] text-foreground tabular-nums">
                  {formatPoints(row.points)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${expanded ? "Hide" : "Show"} where ${row.name}'s points came from`}
                    aria-expanded={expanded}
                    onClick={() => toggle(row.user_id)}
                  >
                    <ChevronDownIcon className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
              {expanded && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={target !== null ? 5 : 4} className="pt-0 pb-3">
                    <Breakdown row={row} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
