import { addDays, eachDate } from "@/lib/seo/dates";
import type { ChannelTotal, DateRange } from "@/lib/seo/types";
import type { DailyChannelRow, DailySearchRow } from "@/lib/seo/transform";
import type { ChannelTraffic } from "./analytics-data";

// Synthetic numbers for developing the UI without Google credentials. Only used
// when isDemoMode() is true, and every response is marked source: "demo".
// Values are seeded by date, so a given day always shows the same numbers.

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function trend(date: string): number {
  const day = Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 0.72 : 1;
  return (1 + ((day % 365) / 365) * 0.6) * weekend;
}

export const DEMO_PROPERTY = "sc-domain:example.com";

/** Mimics Search Console's 2–3 day processing lag. */
export function demoSearchRows(range: DateRange): DailySearchRow[] {
  const lastFinal = addDays(range.endDate, -2);
  return eachDate(range)
    .filter((date) => date <= lastFinal)
    .map((date) => {
      const impressions = Math.round(1800 * trend(date) * (0.8 + seeded(`imp${date}`) * 0.4));
      const ctr = 0.021 + seeded(`ctr${date}`) * 0.018;
      return { date, impressions, clicks: Math.round(impressions * ctr) };
    });
}

const DEMO_CHANNELS: [string, number][] = [
  ["Organic Search", 210],
  ["Direct", 140],
  ["Referral", 55],
  ["Organic Social", 48],
  ["Email", 22],
  ["Paid Search", 18],
  ["Unassigned", 6],
];

export function demoChannelTraffic(range: DateRange): ChannelTraffic {
  const rows: DailyChannelRow[] = [];
  for (const date of eachDate(range)) {
    for (const [channel, base] of DEMO_CHANNELS) {
      const users = Math.round(base * trend(date) * (0.7 + seeded(`${channel}${date}`) * 0.6));
      if (users > 0) rows.push({ date, channel, users });
    }
  }

  // Returning visitors are counted once per period, so period totals sit below the daily sums.
  const days = eachDate(range).length;
  const overlap = days > 1 ? 0.62 : 1;
  const channelTotals: ChannelTotal[] = DEMO_CHANNELS.map(([channel]) => ({
    channel,
    users: Math.round(rows.filter((r) => r.channel === channel).reduce((s, r) => s + r.users, 0) * overlap),
  }));
  const totalUsers = Math.round(channelTotals.reduce((s, c) => s + c.users, 0) * 0.88);

  return { rows, channelTotals, totalUsers };
}
