import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentSnippet, formatRef, parseRef } from "@/lib/refs";

describe("short references", () => {
  it("formats a task number with its prefix", () => {
    assert.equal(formatRef(341), "T-341");
  });

  it("reads the forms people paste", () => {
    for (const text of ["T-341", "t-341", "T341", "#T-341", "  T-341 "]) {
      assert.deepEqual(parseRef(text), { number: 341, ref: "T-341" });
    }
  });

  it("rejects anything that isn't a task reference", () => {
    for (const text of ["", "T-", "T-0", "X-12", "G-3", "I-7", "T-12a", "cmh3x9k2a0001", "T-12 and T-3"]) {
      assert.equal(parseRef(text), null, text);
    }
  });

  it("builds a paste-ready snippet with the link and the lookup", () => {
    const snippet = agentSnippet({
      ref: "T-341",
      title: "Write the launch email",
      status: "in progress",
      origin: "https://amp.example",
      projectSlug: "zedu",
    });
    assert.equal(
      snippet,
      [
        "Amp task T-341: Write the launch email",
        "Status: in progress.",
        "Link: https://amp.example/p/zedu/T-341",
        "Details: GET https://amp.example/api/refs/T-341 with your Amp agent key.",
      ].join("\n")
    );
  });
});
