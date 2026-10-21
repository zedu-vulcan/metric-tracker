"use client";

import { useCallback, useEffect, useState } from "react";
import { HistoryIcon, RotateCwIcon } from "lucide-react";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { POINTS_TIMEZONE } from "@/lib/points";
import { apiFetch } from "@/lib/request-json";
import type { ScoreboardResponse } from "@/lib/schemas/scoreboard";
import { cn } from "@/lib/utils";
import { EarnPanel } from "./EarnPanel";
import { HistoryDialog } from "./HistoryDialog";
import { PointsTable } from "./PointsTable";

export type RangeSelection = "this_week" | "last_week" | "all_time";

const RANGES: { value: RangeSelection; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "all_time", label: "All time" },
];

const weekDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: POINTS_TIMEZONE });

async function fetchScoreboard(range: RangeSelection): Promise<ScoreboardResponse> {
  const response = await apiFetch(`/api/scoreboard?range=${range}`);
  if (!response.ok) throw new Error("Couldn't load the scoreboard.");
  return (await response.json()) as ScoreboardResponse;
}

function weekLabel(board: ScoreboardResponse) {
  // The range end is exclusive (next Monday 00:00), so step back a minute to land on Sunday.
  const end = new Date(new Date(board.range.end).getTime() - 60_000);
  return `${weekDay.format(new Date(board.range.start))} – ${weekDay.format(end)}`;
}

export function ScoreboardView({ currentUser }: { currentUser: { id: string; name: string } }) {
  const [range, setRange] = useState<RangeSelection>("this_week");
  const [boards, setBoards] = useState<Partial<Record<RangeSelection, ScoreboardResponse>>>({});
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async (selection: RangeSelection) => {
    setError(null);
    try {
      const board = await fetchScoreboard(selection);
      setBoards((previous) => ({ ...previous, [selection]: board }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the scoreboard.");
    }
  }, []);

  useEffect(() => {
    void load("this_week");
  }, [load]);

  const changeRange = (next: RangeSelection) => {
    setRange(next);
    void load(next);
  };

  const selected = boards[range] ?? null;
  const thisWeek = boards.this_week ?? null;
  const rangeLabel = RANGES.find((option) => option.value === range)?.label ?? "This week";

  return (
    <>
      <PageHeader
        title="Scoreboard"
        description={
          thisWeek
            ? `Week of ${weekLabel(thisWeek)} · resets Sunday 23:59, Lagos time. Everyone aims for ${thisWeek.target} points a week.`
            : "Points earned by everyone in this project, week by week."
        }
        actions={
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <HistoryIcon data-icon="inline-start" aria-hidden="true" />
            My points history
          </Button>
        }
      />

      <PageContent>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => void load(range)}>
                <RotateCwIcon data-icon="inline-start" aria-hidden="true" />
                Try again
              </Button>
            </AlertAction>
          </Alert>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>
                  {selected
                    ? `${selected.rows.length} ${selected.rows.length === 1 ? "person" : "people"} · ${rangeLabel.toLowerCase()}`
                    : "Loading…"}
                </CardDescription>
              </div>
              <div role="group" aria-label="Period" className="flex shrink-0 rounded-full bg-muted p-1">
                {RANGES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={range === option.value}
                    onClick={() => changeRange(option.value)}
                    className={cn(
                      "h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      range === option.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {selected ? (
                <PointsTable
                  rows={selected.rows}
                  target={range === "all_time" ? null : selected.target}
                  currentUserId={currentUser.id}
                />
              ) : (
                <div className="flex flex-col gap-2" aria-busy="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selected ?? thisWeek ? (
            <EarnPanel rules={(selected ?? thisWeek)!.rules} />
          ) : (
            <Skeleton className="h-[420px] rounded-[22px]" aria-label="Loading ways to earn" />
          )}
        </div>
      </PageContent>

      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
