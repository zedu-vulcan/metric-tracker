"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatCompact,
  formatInteger,
  formatLongDate,
  formatPercent,
  formatRange,
  formatShortDate,
} from "@/lib/seo/format";
import type { DateRange, SearchPerformancePoint, SearchPerformanceResponse } from "@/lib/seo/types";
import { AXIS_TICK, CURSOR, GRID_STROKE, LegendToggle, TooltipCard, TooltipRow } from "./chartParts";
import { ReportEmpty, ReportErrorState, ReportLoading } from "./ReportStates";
import { ReportSection, SummaryStat } from "./ReportSection";
import type { ReportState } from "./useSeoReport";

type MetricKey = "clicks" | "impressions";

const METRICS: { key: MetricKey; label: string; color: string; swatch: string }[] = [
  { key: "clicks", label: "Clicks", color: "var(--series-1)", swatch: "bg-series-1" },
  { key: "impressions", label: "Impressions", color: "var(--series-2)", swatch: "bg-series-2" },
];

interface TooltipContentProps {
  active?: boolean;
  payload?: { payload?: unknown }[];
}

function SearchTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as SearchPerformancePoint | undefined;
  if (!active || !point) return null;
  return (
    <TooltipCard title={formatLongDate(point.date)}>
      <TooltipRow swatch="bg-series-1" label="Clicks" value={formatInteger(point.clicks)} />
      <TooltipRow swatch="bg-series-2" label="Impressions" value={formatInteger(point.impressions)} />
      <TooltipRow label="CTR" value={formatPercent(point.ctr)} />
    </TooltipCard>
  );
}

function DailyTable({ points }: { points: SearchPerformancePoint[] }) {
  return (
    <details className="group border-t px-4 py-2.5 sm:px-5">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none hover:text-foreground">
        View daily figures as a table
      </summary>
      <div className="mt-2 max-h-72 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">CTR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((p) => (
              <TableRow key={p.date}>
                <TableCell>{formatLongDate(p.date)}</TableCell>
                <TableCell className="text-right font-mono">{formatInteger(p.clicks)}</TableCell>
                <TableCell className="text-right font-mono">{formatInteger(p.impressions)}</TableCell>
                <TableCell className="text-right font-mono">{formatPercent(p.ctr)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}

function Panels({ points }: { points: SearchPerformancePoint[] }) {
  const [hidden, setHidden] = useState<Set<MetricKey>>(new Set());
  const [hovered, setHovered] = useState<MetricKey | null>(null);
  const visible = METRICS.filter((m) => !hidden.has(m.key));

  const toggle = (key: MetricKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-2 px-2 pb-3 sm:px-3">
      <div className="flex flex-wrap items-center gap-1 px-2" role="group" aria-label="Show or hide series">
        {METRICS.map((m) => (
          <LegendToggle
            key={m.key}
            label={m.label}
            swatch={m.swatch}
            pressed={!hidden.has(m.key)}
            disabled={!hidden.has(m.key) && visible.length === 1}
            onToggle={() => toggle(m.key)}
          />
        ))}
      </div>

      {/* Clicks are usually 1–5% of impressions, so each metric gets its own
          scale in an aligned panel rather than a misleading dual-axis chart. */}
      {visible.map((metric, index) => {
        const isLast = index === visible.length - 1;
        const height = (visible.length === 2 ? 140 : 260) + (isLast ? 28 : 0);
        return (
          <div
            key={metric.key}
            className="flex flex-col"
            onMouseEnter={() => setHovered(metric.key)}
            onMouseLeave={() => setHovered(null)}
            onFocusCapture={() => setHovered(metric.key)}
            onBlurCapture={() => setHovered(null)}
          >
            <span className="px-2 text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase">
              {metric.label}
            </span>
            <ResponsiveContainer width="100%" height={height}>
              <LineChart
                data={points}
                syncId="search-performance"
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                accessibilityLayer
                title={`${metric.label} per day`}
              >
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis
                  dataKey="date"
                  hide={!isLast}
                  tickFormatter={formatShortDate}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border-strong)" }}
                  minTickGap={28}
                  tickMargin={8}
                />
                <YAxis
                  width={48}
                  tickFormatter={formatCompact}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickCount={4}
                />
                <Tooltip
                  cursor={CURSOR}
                  isAnimationActive={false}
                  content={(props: TooltipContentProps) =>
                    hovered === metric.key ? <SearchTooltip {...props} /> : null
                  }
                />
                <Line
                  type="monotone"
                  dataKey={metric.key}
                  name={metric.label}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

export function ClicksImpressionsChart({
  report,
  requestedRange,
  onRetry,
}: {
  report: ReportState<SearchPerformanceResponse>;
  requestedRange: DateRange | null;
  onRetry: () => void;
}) {
  const { data, error, isFetching } = report;
  const matchesRange =
    data !== null &&
    requestedRange !== null &&
    data.range.startDate === requestedRange.startDate &&
    data.range.endDate === requestedRange.endDate;
  // Never show numbers from a different range next to an error for the current one.
  const showData = data !== null && (!error || matchesRange);

  let body: React.ReactNode;
  if (error && !showData) {
    body = <ReportErrorState service="Search Console" error={error} onRetry={onRetry} />;
  } else if (!data) {
    body = <ReportLoading label="Loading Search Console data…" />;
  } else if (data.points.length === 0) {
    body = (
      <ReportEmpty
        title="No Search Console data for this period"
        description="Google hasn't reported any search impressions for these dates yet. The latest 2–3 days are always pending."
      />
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-3 gap-4 border-b px-4 py-4 sm:px-5 [&>*+*]:border-l [&>*+*]:pl-4">
          <SummaryStat label="Clicks" swatch="bg-series-1" value={formatInteger(data.totals.clicks)} />
          <SummaryStat label="Impressions" swatch="bg-series-2" value={formatInteger(data.totals.impressions)} />
          <SummaryStat label="Avg. CTR" value={formatPercent(data.totals.ctr)} hint="Clicks ÷ impressions" />
        </div>
        {error && (
          <div className="px-4 pt-3 sm:px-5">
            <ReportErrorState compact service="Search Console" error={error} onRetry={onRetry} />
          </div>
        )}
        <div className="pt-3">
          <Panels points={data.points} />
        </div>
        <DailyTable points={data.points} />
      </>
    );
  }

  const footer = data && showData && (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      <span>
        Google Search (web) results for <span className="font-mono text-foreground">{data.property}</span>
      </span>
      <span>
        {data.availableThrough
          ? `Data through ${formatShortDate(data.availableThrough)} · Search Console finalises each day 2–3 days later`
          : "Search Console finalises each day 2–3 days later"}
      </span>
    </span>
  );

  return (
    <ReportSection
      id="clicks-impressions"
      title="Clicks vs. Impressions"
      subtitle={
        showData && data
          ? `How often zedu.chat appeared in Google Search and how often people clicked through · ${formatRange(data.range.startDate, data.range.endDate)}`
          : "How often zedu.chat appeared in Google Search and how often people clicked through."
      }
      provider="Search Console"
      source={showData ? data?.source : undefined}
      busy={isFetching && showData}
      footer={footer}
    >
      {body}
    </ReportSection>
  );
}
