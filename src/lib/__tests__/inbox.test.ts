import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INBOX_COMMENT_LIMIT, INBOX_COMMENT_WINDOW_MS, secondsUntil } from "@/lib/inbox";
import { getOpenApiDocument } from "@/lib/openapi";

describe("Agent inbox helpers", () => {
  it("counts down to a future offer expiry", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    const expiry = new Date("2026-10-20T12:01:30.000Z");
    assert.equal(secondsUntil(expiry, now), 90);
  });

  it("never returns a negative countdown", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    const expiry = new Date("2026-10-20T11:59:00.000Z");
    assert.equal(secondsUntil(expiry, now), 0);
  });

  it("keeps the documented comment window and limit", () => {
    assert.equal(INBOX_COMMENT_WINDOW_MS, 24 * 60 * 60 * 1000);
    assert.equal(INBOX_COMMENT_LIMIT, 50);
  });

  it("keeps the canonical agentKey security scheme in OpenAPI", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.components?.securitySchemes?.agentKey);
  });

  it("registers the inbox endpoint with agent-key auth", () => {
    const doc = getOpenApiDocument();
    const path = doc.paths?.["/api/me/inbox"];
    assert.ok(path?.get);
    assert.deepEqual(path.get.security, [{ agentKey: [] }]);
  });
});
