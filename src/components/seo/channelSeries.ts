import type { TrafficChannelsPoint, TrafficChannelsResponse } from "@/lib/seo/types";

// Colour follows the channel, never its rank, so a channel keeps its colour
// across date ranges. The order here is also the stacking order (bottom → top)
// and was validated so neighbouring bands stay distinguishable with
// colour-vision deficiencies. Channels outside this list fold into "Other".
const CHANNEL_SLOTS = [
  { channel: "Organic Search", color: "var(--series-1)", swatch: "bg-series-1" },
  { channel: "Direct", color: "var(--series-2)", swatch: "bg-series-2" },
  { channel: "Referral", color: "var(--series-3)", swatch: "bg-series-3" },
  { channel: "Organic Social", color: "var(--series-4)", swatch: "bg-series-4" },
  { channel: "Paid Search", color: "var(--series-5)", swatch: "bg-series-5" },
  { channel: "Email", color: "var(--series-6)", swatch: "bg-series-6" },
  { channel: "Paid Social", color: "var(--series-7)", swatch: "bg-series-7" },
  { channel: "Display", color: "var(--series-8)", swatch: "bg-series-8" },
] as const;

export const OTHER_SERIES = { color: "var(--series-other)", swatch: "bg-series-other" } as const;

export interface ChannelSeries {
  /** Safe chart dataKey (channel names can contain characters chart libraries treat as paths). */
  key: string;
  label: string;
  color: string;
  swatch: string;
  /** GA4 channels drawn by this series: one, or several for "Other channels". */
  channels: string[];
  /** Period users per channel summed; only used for ordering and labels, not as unique users. */
  users: number;
}

export function buildChannelSeries(data: TrafficChannelsResponse): ChannelSeries[] {
  const present = new Map(data.channels.map((c) => [c.channel, c.users]));
  const series: ChannelSeries[] = [];

  CHANNEL_SLOTS.forEach((slot, index) => {
    const users = present.get(slot.channel);
    if (users === undefined) return;
    series.push({ key: `s${index}`, label: slot.channel, color: slot.color, swatch: slot.swatch, channels: [slot.channel], users });
  });

  const known = new Set<string>(CHANNEL_SLOTS.map((s) => s.channel));
  const others = data.channels.filter((c) => !known.has(c.channel));
  if (others.length === 1) {
    const [only] = others;
    series.push({ key: "other", label: only.channel, ...OTHER_SERIES, channels: [only.channel], users: only.users });
  } else if (others.length > 1) {
    series.push({
      key: "other",
      label: `Other channels (${others.length})`,
      ...OTHER_SERIES,
      channels: others.map((c) => c.channel),
      users: others.reduce((sum, c) => sum + c.users, 0),
    });
  }
  return series;
}

export function swatchFor(channel: string, series: ChannelSeries[]): string {
  return series.find((s) => s.channels.includes(channel))?.swatch ?? OTHER_SERIES.swatch;
}

export type ChannelChartRow = { date: string } & Record<string, number | string>;

export function toChartRows(points: TrafficChannelsPoint[], series: ChannelSeries[]): ChannelChartRow[] {
  return points.map((point) => {
    const row: ChannelChartRow = { date: point.date };
    for (const s of series) row[s.key] = s.channels.reduce((sum, c) => sum + (point.users[c] ?? 0), 0);
    return row;
  });
}
