"use client";

import { useCallback, useEffect, useState } from "react";
import { TrophyIcon } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { PillSelect, Toolbar, ToolbarGroup } from "@/components/Toolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { POINTS_TIMEZONE, WEEKLY_TARGET, daysLeftInWeek } from "@/lib/points";
import type { ScoreboardResponse } from "@/lib/schemas/scoreboard";
import { EarnPanel } from "./EarnPanel";
import { HistoryDialog } from "./HistoryDialog";
import { PointsTable } from "./PointsTable";

type RangeSelection = "this_week" | "last_week" | "all_time";

const RANGE_OPTIONS: { value: RangeSelection; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "all_time", label: "All time" },
];

function formatPoints(value: number): string {
  return value.toLocaleString("en-GB");
}

async function fetchScoreboardJson(range: RangeSelection): Promise<ScoreboardResponse> {
  const response = await fetch(`/api/scoreboard?range=${range}`);
  if (!response.ok) throw new Error(`Failed to load the scoreboard (${response.status})`);
  return (await response.json()) as ScoreboardResponse;
}

export function ScoreboardView({ currentUser }: { currentUser: { id: string; name: string } }) {
  const [range, setRange] = useState<RangeSelection>("this_week");
  const [thisWeek, setThisWeek] = useState<ScoreboardResponse | null>(null);
  const [selected, setSelected] = useState<ScoreboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async (selection: RangeSelection) => {
    setError(null);
    try {
      const [week, chosen] = await Promise.all([
        fetchScoreboardJson("this_week"),
        selection === "this_week" ? null : fetchScoreboardJson(selection),
      ]);
      setThisWeek(week);
      setSelected(chosen ?? week);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load the scoreboard.");
    }
  }, []);

  useEffect(() => {
    void load("this_week");
  }, [load]);

  const changeRange = (value: string) => {
    setRange(value as RangeSelection);
    void load(value as RangeSelection);
  };

  const currentRow = thisWeek?.rows.find((row) => row.user_id === currentUser.id);
  const atTarget = thisWeek?.rows.filter((row) => row.points >= thisWeek.target).length ?? 0;
  const daysLeft = thisWeek
    ? daysLeftInWeek({ start: new Date(thisWeek.range.start), end: new Date(thisWeek.range.end) }, new Date())
    : daysLeftInWeek({ start: new Date(), end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, new Date());

  const loading = !selected && !error;

  return (
    <>
      <PageHeader
        title="Scoreboard"
        description={`Weekly points for the Zedu project. Reach ${thisWeek?.target ?? WEEKLY_TARGET} to hit target.`}
      />

      <PageContent>
        <Toolbar>
          <ToolbarGroup>
            <PillSelect
              label="Range"
              value={range}
              onChange={changeRange}
              options={RANGE_OPTIONS}
              defaultValue="this_week"
            />
          </ToolbarGroup>
        </Toolbar>

        {loading ? (
          <KpiGrid>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-[140px] rounded-[22px]" />
            ))}
          </KpiGrid>
        ) : (
          <KpiGrid>
            <KpiCard
              title="Your points this week"
              value={formatPoints(currentRow?.points ?? 0)}
              context={`of ${thisWeek?.target ?? WEEKLY_TARGET} target`}
              action={{ label: "Open my points history", onClick: () => setHistoryOpen(true) }}
            />
            <KpiCard
              title="Team at target"
              value={`${atTarget} of ${thisWeek?.rows.length ?? 0}`}
              context={`reached ${thisWeek?.target ?? WEEKLY_TARGET} this week`}
            />
            <KpiCard
              title="Days left in the week"
              value={String(daysLeft)}
              context={`until Sunday 23:59 (${POINTS_TIMEZONE})`}
            />
          </KpiGrid>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button variant="outline" size="sm" className="mt-2 self-start" onClick={() => void load(range)}>
              Try again
            </Button>
          </Alert>
        )}

        {!error && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Card>
              <CardHeader>
                <div className="flex w-full items-center justify-between gap-3">
                  <CardTitle>Leaderboard</CardTitle>
                  {selected && (
                    <span className="text-sm font-semibold text-muted-foreground tabular-nums">{selected.rows.length} people</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                {loading && (
                  <div className="flex flex-col gap-2 py-1">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Skeleton key={index} className="h-14 w-full rounded-xl" />
                    ))}
                  </div>
                )}

                {selected && selected.rows.length === 0 && (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep">
                        <TrophyIcon className="size-5" aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>No points earned yet</EmptyTitle>
                      <EmptyDescription>Points appear here once work is approved and reviewed.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}

                {selected && selected.rows.length > 0 && (
                  <PointsTable rows={selected.rows} target={selected.target} currentUserId={currentUser.id} />
                )}
              </CardContent>
            </Card>

            {selected && <EarnPanel rules={selected.rules} />}
          </div>
        )}
      </PageContent>

      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
