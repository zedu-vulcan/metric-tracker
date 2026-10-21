import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commentCreateSchema } from "@/lib/schemas/comments";
import { getOpenApiDocument } from "@/lib/openapi";

describe("commentCreateSchema - Schema Validation", () => {
  it("accepts valid comment payloads (note, bid, delivery, escalation)", () => {
    const notePayload = {
      type: "note",
      body: "Weekly progress update on goal metrics.",
    };
    const noteResult = commentCreateSchema.safeParse(notePayload);
    assert.equal(noteResult.success, true);
    if (noteResult.success) {
      assert.equal(noteResult.data.type, "note");
      assert.equal(noteResult.data.body, notePayload.body);
    }

    const bidPayload = {
      type: "bid",
      body: "Agent ready to claim this task. Estimated completion in 48 hours.",
    };
    const bidResult = commentCreateSchema.safeParse(bidPayload);
    assert.equal(bidResult.success, true);
    if (bidResult.success) {
      assert.equal(bidResult.data.type, "bid");
    }

    const deliveryPayload = {
      type: "delivery",
      body: "Draft article deliverables attached for team review.",
      attachment: "https://storage.example.com/artifacts/article-v1.md",
    };
    const deliveryResult = commentCreateSchema.safeParse(deliveryPayload);
    assert.equal(deliveryResult.success, true);
    if (deliveryResult.success) {
      assert.equal(deliveryResult.data.type, "delivery");
      assert.equal(deliveryResult.data.attachment, deliveryPayload.attachment);
    }

    const escalationPayload = {
      type: "escalation",
      body: "Blocked by external API rate limit. Requesting human intervention.",
    };
    const escalationResult = commentCreateSchema.safeParse(escalationPayload);
    assert.equal(escalationResult.success, true);
    if (escalationResult.success) {
      assert.equal(escalationResult.data.type, "escalation");
    }
  });

  it("defaults type to 'note' when omitted", () => {
    const payload = {
      body: "This is a comment where type was omitted by the caller.",
    };
    const result = commentCreateSchema.safeParse(payload);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.type, "note");
      assert.equal(result.data.body, payload.body);
    }
  });

  it("rejects empty comment body (body: \"\")", () => {
    const emptyBody = {
      type: "note",
      body: "",
    };
    const emptyResult = commentCreateSchema.safeParse(emptyBody);
    assert.equal(emptyResult.success, false);

    const whitespaceBody = {
      type: "note",
      body: "    ",
    };
    const whitespaceResult = commentCreateSchema.safeParse(whitespaceBody);
    assert.equal(whitespaceResult.success, false);

    const missingBody = {
      type: "note",
    };
    const missingResult = commentCreateSchema.safeParse(missingBody);
    assert.equal(missingResult.success, false);
  });

  it("validates character limits (body max 10,000, title max 200)", () => {
    const validMaxBody = {
      type: "note",
      body: "x".repeat(10000),
    };
    assert.equal(commentCreateSchema.safeParse(validMaxBody).success, true);

    const oversizedBody = {
      type: "note",
      body: "x".repeat(10001),
    };
    assert.equal(commentCreateSchema.safeParse(oversizedBody).success, false);

    const validTitle = {
      type: "note",
      title: "t".repeat(200),
      body: "Valid body text",
    };
    assert.equal(commentCreateSchema.safeParse(validTitle).success, true);

    const oversizedTitle = {
      type: "note",
      title: "t".repeat(201),
      body: "Valid body text",
    };
    assert.equal(commentCreateSchema.safeParse(oversizedTitle).success, false);
  });

  it("validates review scores (1–10)", () => {
    // Valid boundary and mid scores
    assert.equal(
      commentCreateSchema.safeParse({ body: "Min score", score: 1 }).success,
      true
    );
    assert.equal(
      commentCreateSchema.safeParse({ body: "Mid score", score: 5 }).success,
      true
    );
    assert.equal(
      commentCreateSchema.safeParse({ body: "Max score", score: 10 }).success,
      true
    );

    // Score out of range (below 1)
    assert.equal(
      commentCreateSchema.safeParse({ body: "Zero score", score: 0 }).success,
      false
    );
    assert.equal(
      commentCreateSchema.safeParse({ body: "Negative score", score: -1 }).success,
      false
    );

    // Score out of range (above 10)
    assert.equal(
      commentCreateSchema.safeParse({ body: "Above max score", score: 11 }).success,
      false
    );

    // Score must be an integer
    assert.equal(
      commentCreateSchema.safeParse({ body: "Decimal score", score: 8.5 }).success,
      false
    );

    // Score is optional / nullable
    assert.equal(
      commentCreateSchema.safeParse({ body: "No score provided" }).success,
      true
    );
    assert.equal(
      commentCreateSchema.safeParse({ body: "Null score provided", score: null }).success,
      true
    );
  });
});

describe("Delivery & Attachment Rules", () => {
  it("rejects type: \"delivery\" if attachment is missing or empty", () => {
    const missingAttachment = {
      type: "delivery",
      body: "Submitted without attachment",
    };
    const missingResult = commentCreateSchema.safeParse(missingAttachment);
    assert.equal(missingResult.success, false);

    const emptyAttachment = {
      type: "delivery",
      body: "Submitted with empty string attachment",
      attachment: "",
    };
    const emptyResult = commentCreateSchema.safeParse(emptyAttachment);
    assert.equal(emptyResult.success, false);

    const whitespaceAttachment = {
      type: "delivery",
      body: "Submitted with whitespace attachment",
      attachment: "    ",
    };
    const whitespaceResult = commentCreateSchema.safeParse(whitespaceAttachment);
    assert.equal(whitespaceResult.success, false);

    const nullAttachment = {
      type: "delivery",
      body: "Submitted with null attachment",
      attachment: null,
    };
    const nullResult = commentCreateSchema.safeParse(nullAttachment);
    assert.equal(nullResult.success, false);
  });

  it("accepts type: \"delivery\" with valid attachment", () => {
    const validDelivery = {
      type: "delivery",
      body: "All requested deliverables completed according to specification.",
      attachment: "https://github.com/zedu-vulcan/metric-tracker/pull/27",
    };
    const result = commentCreateSchema.safeParse(validDelivery);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.type, "delivery");
      assert.equal(result.data.attachment, validDelivery.attachment);
    }
  });

  it("allows non-delivery comments with or without attachments", () => {
    const noteWithoutAttachment = {
      type: "note",
      body: "Note without attachment",
    };
    assert.equal(commentCreateSchema.safeParse(noteWithoutAttachment).success, true);

    const noteWithAttachment = {
      type: "note",
      body: "Note with helpful link",
      attachment: "https://example.com/reference",
    };
    assert.equal(commentCreateSchema.safeParse(noteWithAttachment).success, true);
  });
});

describe("OpenAPI Registration", () => {
  it("asserts that both GET and POST for /api/tasks/{id}/comments exist in getOpenApiDocument()", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths, "paths object exists in OpenAPI doc");

    const pathItem = doc.paths["/api/tasks/{id}/comments"];
    assert.ok(pathItem, "/api/tasks/{id}/comments route is registered in OpenAPI doc");
    assert.ok(pathItem.get, "GET /api/tasks/{id}/comments method is registered");
    assert.ok(pathItem.post, "POST /api/tasks/{id}/comments method is registered");

    assert.equal(pathItem.get.tags?.[0], "Tasks");
    assert.equal(pathItem.post.tags?.[0], "Tasks");
  });
});
