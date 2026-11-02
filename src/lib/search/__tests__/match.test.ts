import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { textMatch } from "../match";

describe("literal search matching", () => {
  const cases = [
    { name: "ordinary text", query: "SEO audit", expected: "SEO audit" },
    { name: "percent signs", query: "100%", expected: "100\\%" },
    { name: "underscores", query: "task_name", expected: "task\\_name" },
    { name: "backslashes", query: "docs\\draft", expected: "docs\\\\draft" },
    { name: "trailing backslashes", query: "docs\\", expected: "docs\\\\" },
    { name: "backslashes before wildcards", query: "\\%\\_", expected: "\\\\\\%\\\\\\_" },
    { name: "consecutive backslashes", query: "\\\\", expected: "\\\\\\\\" },
  ];

  for (const { name, query, expected } of cases) {
    it(`matches ${name} literally`, () => {
      assert.deepStrictEqual(textMatch(query), {
        contains: expected,
        mode: "insensitive",
      });
    });
  }
});
