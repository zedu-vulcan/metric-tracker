"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCompact, formatInteger, formatLongDate, formatRange, formatShortDate } from "@/lib/seo/format";
import type { DateRange, TrafficChannelsResponse } from "@/lib/seo/types";
import { AXIS_TICK, CURSOR, GRID_STROKE, LegendToggle, TooltipCard, TooltipRow } from "./chartParts";
import { buildChannelSeries, swatchFor, toChartRows, type ChannelChartRow, type ChannelSeries } from "./channelSeries";
import { ReportEmpty, ReportErrorState, ReportLoading } from "./ReportStates";
import { ReportSection, SummaryStat } from "./ReportSection";
import type { ReportState } from "./useSeoReport";

interface TooltipContentProps {
  active?: boolean;
  payload?: { payload?: unknown }[];
}

function ChannelTooltip({ active, payload, series }: TooltipContentProps & { series: ChannelSeries[] }) {
  const row = payload?.[0]?.payload as ChannelChartRow | undefined;
  if (!active || !row) return null;
  // List top band first, matching the stack as the reader sees it.
  return (
    <TooltipCard title={formatLongDate(String(row.date))}>
      {[...series].reverse().map((s) => (
        <TooltipRow key={s.key} swatch={s.swatch} label={s.label} value={formatInteger(Number(row[s.key] ?? 0))} />
      ))}
    </TooltipCard>
  );
}

function ChannelTable({ data, series }: { data: TrafficChannelsResponse; series: ChannelSeries[] }) {
  return (
    <div className="border-t px-4 py-3 sm:px-5">
      <Table>
        <caption className="sr-only">Active users by session default channel group for the selected period</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Users</TableHead>
            <TableHead className="text-right">
              <abbr title="Share of all site users who had at least one session from this channel" className="no-underline">
                % of users
              </abbr>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.channels.map((c) => (
            <TableRow key={c.channel}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", swatchFor(c.channel, series))} />
                  {c.channel}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">{formatInteger(c.users)}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {data.totalUsers > 0 ? `${((c.users / data.totalUsers) * 100).toFixed(1)}%` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StackedChannels({ data, series }: { data: TrafficChannelsResponse; series: ChannelSeries[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const rows = useMemo(() => toChartRows(data.points, series), [data.points, series]);
  const visible = series.filter((s) => !hidden.has(s.key));

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-2 px-2 pt-3 pb-3 sm:px-3">
      <div className="flex flex-wrap items-center gap-1 px-2" role="group" aria-label="Show or hide channels">
        {series.map((s) => (
          <LegendToggle
            key={s.key}
            label={s.label}
            swatch={s.swatch}
            shape="block"
            pressed={!hidden.has(s.key)}
            disabled={!hidden.has(s.key) && visible.length === 1}
            onToggle={() => toggle(s.key)}
          />
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={rows}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          accessibilityLayer
          title="Active users per day, stacked by channel"
        >
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="date"
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
            tickCount={5}
          />
          <Tooltip
            cursor={CURSOR}
            isAnimationActive={false}
            content={(props: TooltipContentProps) => <ChannelTooltip {...props} series={visible} />}
          />
          {visible.map((s) => (
            <Area
              key={s.key}
              type="monotoneX"
              dataKey={s.key}
              name={s.label}
              stackId="channels"
              fill={s.color}
              fillOpacity={0.9}
              stroke="var(--card)"
              strokeWidth={1.5}
              activeDot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrafficChannelsChart({
  report,
  requestedRange,
  onRetry,
}: {
  report: ReportState<TrafficChannelsResponse>;
  requestedRange: DateRange | null;
  onRetry: () => void;
}) {
  const { data, error, isFetching } = report;
  const series = useMemo(() => (data ? buildChannelSeries(data) : []), [data]);
  const matchesRange =
    data !== null &&
    requestedRange !== null &&
    data.range.startDate === requestedRange.startDate &&
    data.range.endDate === requestedRange.endDate;
  const showData = data !== null && (!error || matchesRange);

  let body: React.ReactNode;
  if (error && !showData) {
    body = <ReportErrorState service="Google Analytics" error={error} onRetry={onRetry} />;
  } else if (!data) {
    body = <ReportLoading label="Loading Google Analytics data…" />;
  } else if (data.points.length === 0 || data.channels.length === 0) {
    body = (
      <ReportEmpty
        title="No visits recorded for this period"
        description="Google Analytics has no sessions for these dates. Check that the GA4 tag is installed on zedu.chat."
      />
    );
  } else {
    const [top] = data.channels;
    body = (
      <>
        <div className="grid grid-cols-2 gap-4 border-b px-4 py-4 sm:grid-cols-3 sm:px-5 [&>*+*]:border-l [&>*+*]:pl-4">
          <SummaryStat label="Total users" value={formatInteger(data.totalUsers)} hint="Unique active users, all channels" />
          <SummaryStat
            label="Top channel"
            value={top.channel}
            hint={`${formatInteger(top.users)} users`}
          />
          <div className="hidden sm:flex">
            <SummaryStat
              label="Channels"
              value={formatInteger(data.channels.length)}
              hint="With at least one visit"
            />
          </div>
        </div>
        {error && (
          <div className="px-4 pt-3 sm:px-5">
            <ReportErrorState compact service="Google Analytics" error={error} onRetry={onRetry} />
          </div>
        )}
        <StackedChannels data={data} series={series} />
        <ChannelTable data={data} series={series} />
      </>
    );
  }

  const footer = data && showData && (
    <span className="flex flex-col gap-1">
      <span>
        Users = GA4 <span className="font-mono text-foreground">activeUsers</span>, grouped by{" "}
        <span className="font-mono text-foreground">sessionDefaultChannelGroup</span> (how each session arrived). Someone
        who visits through two channels counts once in each, so channel figures add up to more than the site total.
      </span>
      <span>
        {data.availableThrough ? `Data through ${formatShortDate(data.availableThrough)} · ` : ""}GA4 usually processes a
        day&apos;s data within 24–48 hours.
      </span>
    </span>
  );

  return (
    <ReportSection
      id="traffic-channels"
      title="Users Traffic by Channels"
      subtitle={
        showData && data
          ? `Which acquisition channels bring visitors to zedu.chat, day by day · ${formatRange(data.range.startDate, data.range.endDate)}`
          : "Which acquisition channels bring visitors to zedu.chat, day by day."
      }
      provider="Google Analytics 4"
      source={showData ? data?.source : undefined}
      busy={isFetching && showData}
      footer={footer}
    >
      {body}
    </ReportSection>
  );
}
