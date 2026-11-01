import { POINTS_TIMEZONE } from "@/lib/points";

export type ScoreboardPeriod = "this_week" | "last_week" | "all_time";

type PeriodBoard = { range: { start: string; end: string }; target: number };

const weekDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: POINTS_TIMEZONE });

/** "26 Oct – 1 Nov". The range end is exclusive (next Monday 00:00), so step back a minute to land on Sunday. */
export function formatWeekRange(range: { start: string; end: string }): string {
  const end = new Date(new Date(range.end).getTime() - 60_000);
  return `${weekDay.format(new Date(range.start))} – ${weekDay.format(end)}`;
}

/** The sentence under the Scoreboard title, worded for the selected period. */
export function describeScoreboardPeriod(period: ScoreboardPeriod, board: PeriodBoard | null): string {
  if (period === "all_time") {
    return "Every point earned in this project so far. The weekly target only applies to a single week.";
  }
  if (period === "last_week") {
    return board
      ? `Last week, ${formatWeekRange(board.range)} (Lagos time). Everyone aimed for ${board.target} points that week.`
      : "Last week's points, Monday to Sunday, Lagos time.";
  }
  return board
    ? `Week of ${formatWeekRange(board.range)} · resets Sunday 23:59, Lagos time. Everyone aims for ${board.target} points a week.`
    : "Points earned by everyone in this project, week by week.";
}
