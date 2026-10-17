import { eachDate } from "./dates";
import { clickThroughRate } from "./format";
import type {
  ChannelTotal,
  DataSource,
  DateRange,
  SearchPerformancePoint,
  SearchPerformanceResponse,
  TrafficChannelsPoint,
  TrafficChannelsResponse,
} from "./types";

export interface DailySearchRow {
  date: string;
  clicks: number;
  impressions: number;
}

export interface DailyChannelRow {
  date: string;
  channel: string;
  users: number;
}

/**
 * Providers omit days with no activity, and also days that haven't been
 * processed yet. A missing day before the latest returned day genuinely had
 * zero activity, so it's filled with 0. Days after it are unknown and left out
 * rather than drawn as a misleading drop to zero.
 */
function knownDates(range: DateRange, availableThrough: string | null): string[] {
  if (!availableThrough) return [];
  return eachDate({ startDate: range.startDate, endDate: availableThrough });
}

function latestDate(dates: string[]): string | null {
  return dates.reduce<string | null>((latest, d) => (latest === null || d > latest ? d : latest), null);
}

export function buildSearchPerformance(input: {
  range: DateRange;
  rows: DailySearchRow[];
  property: string;
  source: DataSource;
}): SearchPerformanceResponse {
  const { range, rows, property, source } = input;
  const inRange = rows.filter((r) => r.date >= range.startDate && r.date <= range.endDate);
  const byDate = new Map(inRange.map((r) => [r.date, r]));
  const availableThrough = latestDate(inRange.map((r) => r.date));

  const points: SearchPerformancePoint[] = knownDates(range, availableThrough).map((date) => {
    const row = byDate.get(date);
    const clicks = row?.clicks ?? 0;
    const impressions = row?.impressions ?? 0;
    return { date, clicks, impressions, ctr: clickThroughRate(clicks, impressions) };
  });

  const clicks = points.reduce((sum, p) => sum + p.clicks, 0);
  const impressions = points.reduce((sum, p) => sum + p.impressions, 0);

  return {
    source,
    fetchedAt: new Date().toISOString(),
    range,
    availableThrough,
    property,
    points,
    totals: { clicks, impressions, ctr: clickThroughRate(clicks, impressions) },
  };
}

export function buildTrafficChannels(input: {
  range: DateRange;
  rows: DailyChannelRow[];
  /** Per-channel users for the whole period, as reported by GA4 (deduplicated within each channel). */
  channelTotals: ChannelTotal[];
  /** Site-wide users for the whole period, as reported by GA4 (deduplicated across channels). */
  totalUsers: number;
  source: DataSource;
}): TrafficChannelsResponse {
  const { range, rows, channelTotals, totalUsers, source } = input;
  const inRange = rows.filter((r) => r.date >= range.startDate && r.date <= range.endDate);
  const availableThrough = latestDate(inRange.map((r) => r.date));

  const channels = [...channelTotals].filter((c) => c.users > 0).sort((a, b) => b.users - a.users);
  const channelNames = channels.map((c) => c.channel);

  const byDate = new Map<string, Record<string, number>>();
  for (const row of inRange) {
    const day = byDate.get(row.date) ?? {};
    day[row.channel] = (day[row.channel] ?? 0) + row.users;
    byDate.set(row.date, day);
  }

  const points: TrafficChannelsPoint[] = knownDates(range, availableThrough).map((date) => {
    const day = byDate.get(date) ?? {};
    const users: Record<string, number> = {};
    for (const name of channelNames) users[name] = day[name] ?? 0;
    return { date, users };
  });

  return {
    source,
    fetchedAt: new Date().toISOString(),
    range,
    availableThrough,
    metric: "activeUsers",
    channels,
    totalUsers,
    points,
  };
}
