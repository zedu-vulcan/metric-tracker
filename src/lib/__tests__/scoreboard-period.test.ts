import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeScoreboardPeriod, formatWeekRange } from "@/lib/scoreboard-period";

// Lagos is UTC+1, so a Monday 00:00 Lagos week starts at 23:00 UTC on the Sunday before.
const THIS_WEEK = { range: { start: "2026-10-25T23:00:00.000Z", end: "2026-11-01T23:00:00.000Z" }, target: 500 };
const LAST_WEEK = { range: { start: "2026-10-18T23:00:00.000Z", end: "2026-10-25T23:00:00.000Z" }, target: 500 };

describe("formatWeekRange", () => {
  it("runs Monday to the Sunday before the exclusive end, in Lagos time", () => {
    assert.equal(formatWeekRange(THIS_WEEK.range), "26 Oct – 1 Nov");
    assert.equal(formatWeekRange(LAST_WEEK.range), "19 Oct – 25 Oct");
  });
});

describe("describeScoreboardPeriod", () => {
  it("keeps the weekly wording for this week", () => {
    assert.equal(
      describeScoreboardPeriod("this_week", THIS_WEEK),
      "Week of 26 Oct – 1 Nov · resets Sunday 23:59, Lagos time. Everyone aims for 500 points a week."
    );
  });

  it("names last week's own dates instead of this week's", () => {
    const text = describeScoreboardPeriod("last_week", LAST_WEEK);
    assert.match(text, /19 Oct – 25 Oct/);
    assert.doesNotMatch(text, /26 Oct/);
    assert.doesNotMatch(text, /resets/);
  });

  it("drops the weekly range and reset for all time", () => {
    const text = describeScoreboardPeriod("all_time", THIS_WEEK);
    assert.doesNotMatch(text, /Oct|Nov|resets/);
    assert.match(text, /Every point earned/);
  });

  it("falls back to generic copy while a board is still loading", () => {
    assert.equal(describeScoreboardPeriod("this_week", null), "Points earned by everyone in this project, week by week.");
    assert.equal(describeScoreboardPeriod("last_week", null), "Last week's points, Monday to Sunday, Lagos time.");
  });
});
