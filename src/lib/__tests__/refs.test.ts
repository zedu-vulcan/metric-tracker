import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentSnippet, formatRef, parseRef } from "@/lib/refs";

describe("short references", () => {
  it("formats each kind with its prefix", () => {
    assert.equal(formatRef("goal", 12), "G-12");
    assert.equal(formatRef("idea", 7), "I-7");
    assert.equal(formatRef("task", 341), "T-341");
  });

  it("reads the forms people paste", () => {
    for (const text of ["T-341", "t-341", "T341", "#T-341", "  T-341 "]) {
      assert.deepEqual(parseRef(text), { kind: "task", number: 341, ref: "T-341" });
    }
    assert.deepEqual(parseRef("g-3"), { kind: "goal", number: 3, ref: "G-3" });
    assert.deepEqual(parseRef("I-7"), { kind: "idea", number: 7, ref: "I-7" });
  });

  it("rejects anything that isn't a reference", () => {
    for (const text of ["", "T-", "T-0", "X-12", "T-12a", "cmh3x9k2a0001", "T-12 and G-3"]) {
      assert.equal(parseRef(text), null, text);
    }
  });

  it("builds a paste-ready snippet with the link and the lookup", () => {
    const snippet = agentSnippet({
      kind: "task",
      ref: "T-341",
      title: "Write the launch email",
      status: "in progress",
      parent: { label: "Goal", ref: "G-12", title: "Grow signups" },
      origin: "https://amp.example",
      projectSlug: "zedu",
    });
    assert.equal(
      snippet,
      [
        "Amp task T-341: Write the launch email",
        "Status: in progress. Goal G-12: Grow signups.",
        "Link: https://amp.example/p/zedu/T-341",
        "Details: GET https://amp.example/api/refs/T-341 with your Amp agent key.",
      ].join("\n")
    );
  });
});
