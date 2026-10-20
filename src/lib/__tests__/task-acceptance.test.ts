import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";
import { getOpenApiDocument } from "@/lib/openapi";
import { createTaskAcceptanceHandler } from "@/lib/task-acceptance";

type TestTask = {
  id: string;
  status: string;
  title: string;
  description: string | null;
  workstreamId: string | null;
  assignedAgentId: string | null;
  revisionCount: number;
  done: boolean;
};

function createHarness(initialTask: TestTask | null, authStatus?: number) {
  let task = initialTask ? { ...initialTask } : null;
  let updateCalls = 0;
  const handler = createTaskAcceptanceHandler({
    requireUser: async () => ({
      error: authStatus ? NextResponse.json({ error: "Unauthorized" }, { status: authStatus }) : null,
    }),
    findTask: async (id) => (task?.id === id ? { id: task.id, status: task.status } : null),
    acceptProposedTask: async (id) => {
      updateCalls += 1;
      if (!task || task.id !== id || task.status !== "proposed") return 0;
      task = { ...task, status: "open" };
      return 1;
    },
  });

  return {
    handler,
    get task() {
      return task;
    },
    get updateCalls() {
      return updateCalls;
    },
  };
}

const proposedTask: TestTask = {
  id: "task-1",
  status: "proposed",
  title: "Write a guide",
  description: "A helpful guide",
  workstreamId: "workstream-1",
  assignedAgentId: null,
  revisionCount: 1,
  done: false,
};

async function post(handler: ReturnType<typeof createTaskAcceptanceHandler>, id = "task-1") {
  return handler(new Request(`http://localhost/api/tasks/${id}/accept`, { method: "POST" }), { id });
}

describe("POST /api/tasks/{id}/accept", () => {
  it("accepts a proposed task and changes only its status", async () => {
    const harness = createHarness(proposedTask);
    const response = await post(harness.handler);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: "task-1", status: "open" });
    assert.deepEqual(harness.task, { ...proposedTask, status: "open" });
    assert.equal(harness.updateCalls, 1);
  });

  it("returns 400 when the task is already open", async () => {
    const harness = createHarness({ ...proposedTask, status: "open" });
    const response = await post(harness.handler);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Task is not proposed" });
    assert.equal(harness.updateCalls, 0);
  });

  it("returns 400 for another non-proposed state", async () => {
    const harness = createHarness({ ...proposedTask, status: "in_progress" });
    const response = await post(harness.handler);

    assert.equal(response.status, 400);
    assert.equal(harness.updateCalls, 0);
    assert.equal(harness.task?.status, "in_progress");
  });

  it("returns 400 if another request changes the task after lookup", async () => {
    let lookupCount = 0;
    const handler = createTaskAcceptanceHandler({
      requireUser: async () => ({ error: null }),
      findTask: async (id) => ({ id, status: lookupCount++ === 0 ? "proposed" : "open" }),
      acceptProposedTask: async () => 0,
    });
    const response = await post(handler);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Task is not proposed" });
  });

  it("returns 404 when the task does not exist", async () => {
    const harness = createHarness(null);
    const response = await post(harness.handler);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found" });
    assert.equal(harness.updateCalls, 0);
  });

  it("rejects unauthenticated requests", async () => {
    const harness = createHarness(proposedTask, 401);
    const response = await post(harness.handler);

    assert.equal(response.status, 401);
    assert.equal(harness.updateCalls, 0);
  });

  it("rejects agent callers", async () => {
    const harness = createHarness(proposedTask, 403);
    const response = await post(harness.handler);

    assert.equal(response.status, 403);
    assert.equal(harness.updateCalls, 0);
  });

  it("documents the human-only acceptance endpoint in OpenAPI", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    assert.ok(doc.paths["/api/tasks/{id}/accept"]?.post);
  });
});
