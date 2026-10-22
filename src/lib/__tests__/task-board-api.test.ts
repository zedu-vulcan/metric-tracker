import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTaskBoardListHandler, createTaskBoardOptionsHandler } from "@/lib/task-board-api";
import { createTaskBoardFixtures } from "@/lib/fixtures/task-board";
import { getOpenApiDocument } from "@/lib/openapi";

const context = { projectId: "project_demo", userId: "user_demo" };
const request = (query = "") => new Request(`http://localhost/api/tasks/board?${query}`, { headers: { "x-project-id": context.projectId } });
const access = async (_request: Request, options: { allowAgents: false }) => {
  assert.deepEqual(options, { allowAgents: false });
  return { projectId: context.projectId, user: { id: context.userId }, error: null };
};

describe("Board HTTP boundaries", () => {
  for (const status of [400, 401, 403, 404]) {
    it(`preserves access-helper ${status} responses before invoking either service`, async () => {
      const denied = new Response(JSON.stringify({ error: "Access denied" }), { status });
      const requireAccess = async () => ({ projectId: null, user: null, error: denied });
      const unexpected = async (): Promise<never> => { throw new Error("Service should not run"); };
      assert.strictEqual(await createTaskBoardListHandler({ requireAccess, list: unexpected })(request()), denied);
      assert.strictEqual(await createTaskBoardOptionsHandler({ requireAccess, options: unexpected })(request()), denied);
    });
  }
  it("passes server-derived ownership and parsed filters to the list service", async () => {
    const fixtures = createTaskBoardFixtures();
    const handler = createTaskBoardListHandler({
      requireAccess: access,
      list: async (received, query) => {
        assert.deepEqual(received, context);
        assert.equal(query.status, "all");
        assert.equal(query.agent, "mine");
        assert.equal(query.minPoints, 0);
        assert.equal("ownerId" in query, false);
        return { status: "ok", data: fixtures.allStatusesResponse };
      },
    });
    const response = await handler(request("status=all&agent=mine&minPoints=0&ownerId=someone_else"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), fixtures.allStatusesResponse);
  });
  it("passes default availability and page one without inventing filters", async () => {
    const handler = createTaskBoardListHandler({ requireAccess: access, list: async (_context, query) => {
      assert.equal(query.status, "open_for_bids");
      assert.equal(query.page, 1);
      return { status: "ok", data: { tasks: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } };
    } });
    assert.equal((await handler(request())).status, 200);
  });
  it("returns field validation errors for malformed and duplicate URL filters without querying", async () => {
    const handler = createTaskBoardListHandler({ requireAccess: access, list: async () => { throw new Error("Must not query"); } });
    for (const [query, field] of [["status=all&status=open", "status"], ["minPoints=26&maxPoints=25", "maxPoints"], ["page=0", "page"], ["minPoints=1.5", "minPoints"]]) {
      const response = await handler(request(query));
      assert.equal(response.status, 400);
      const body = await response.json() as { error: string; details: Record<string, string[]> };
      assert.equal(body.error, "Validation failed");
      assert.ok(body.details[field].length);
    }
  });
  it("returns the same not-found shape for inaccessible selections and missing projects", async () => {
    const list = createTaskBoardListHandler({ requireAccess: access, list: async () => ({ status: "not_found" }) });
    const options = createTaskBoardOptionsHandler({ requireAccess: access, options: async () => ({ status: "not_found" }) });
    for (const response of [await list(request("goal=missing")), await options(request())]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Not found" });
    }
  });
  it("returns project options without applying list filters", async () => {
    const fixtures = createTaskBoardFixtures();
    const handler = createTaskBoardOptionsHandler({ requireAccess: access, options: async (received) => {
      assert.deepEqual(received, context);
      return { status: "ok", data: fixtures.options };
    } });
    const response = await handler(request("status=approved&page=999"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), fixtures.options);
  });
  it("fails closed if an access dependency unexpectedly returns no human", async () => {
    const requireAccess = async () => ({ projectId: context.projectId, user: null, error: null });
    const handler = createTaskBoardListHandler({ requireAccess, list: async () => { throw new Error("Must not query"); } });
    assert.equal((await handler(request())).status, 401);
  });
});

describe("Board OpenAPI and legacy compatibility", () => {
  it("documents human-only board routes, project header, filters and error responses", () => {
    const document = getOpenApiDocument();
    const list = document.paths?.["/api/tasks/board"]?.get;
    const options = document.paths?.["/api/tasks/board/options"]?.get;
    assert.ok(list);
    assert.ok(options);
    assert.deepEqual(list.security, [{ sessionCookie: [] }]);
    assert.deepEqual(options.security, [{ sessionCookie: [] }]);
    for (const operation of [list, options]) {
      for (const code of [200, 400, 401, 403, 404]) assert.ok(operation.responses?.[code]);
    }
    const parameters = list.parameters?.filter((parameter) => "name" in parameter);
    for (const name of ["x-project-id", "q", "status", "type", "goal", "agent", "minPoints", "maxPoints", "page"]) {
      assert.ok(parameters?.some((parameter) => "name" in parameter && parameter.name === name), name);
    }
    assert.ok(document.paths?.["/api/tasks"]?.get);
    assert.ok(document.paths?.["/api/tasks/{id}"]?.get);
    assert.ok(document.paths?.["/api/agent/tasks"]?.get);
  });
});
