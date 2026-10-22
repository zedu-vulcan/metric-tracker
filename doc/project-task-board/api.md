# Project task board API

Task 1 adds two read-only APIs for human project members to find tasks across their project. The page at `/p/[slug]/tasks` remains a separate frontend assignment. These APIs do not replace the legacy checklist `/api/tasks` or the personal agent feed `/api/agent/tasks`.

## Access and setup

Use the existing Google/NextAuth human session and project membership. Client code should call `apiFetch` from `src/lib/request-json.ts`, which supplies `x-project-id` from the active project. The existing project helper also accepts its legacy `?projectId=` fallback; board share links should use the browser project path, not that fallback.

No new environment variable, dependency, migration or seed is needed. Real API verification requires approved existing application/database configuration. Do not read/share `.env`, run migrations against the shared database or use that database for automated tests.

## GET /api/tasks/board

Query keys and validation are defined by [the shared schema](../../src/lib/schemas/task-board.ts). `parseTaskBoardQuery` preserves duplicate detection at the URL boundary. Missing/blank values use defaults; unknown keys are ignored. Duplicate recognized keys and malformed values return 400.

| Key | Meaning / default |
|---|---|
| `q` | Literal case-insensitive title OR description substring, trimmed, maximum 200 characters |
| `status` | Default `open_for_bids`; `all` or an exact task status |
| `type` | Project task-type slug, not the legacy checklist category |
| `goal` | Project goal ID, any goal status |
| `agent` | Omit for Any; `mine`, `unassigned`, or project agent ID |
| `minPoints`, `maxPoints` | Optional inclusive whole-number bounds, 0 through 2,147,483,647; minimum cannot exceed maximum |
| `page` | Positive integer, default 1; maximum 107,374,183 |

Exact statuses: `proposed`, `open`, `bidding`, `reopened`, `in_progress`, `submitted`, `in_review`, `changes_requested`, `approved`. Filters combine with AND. Search escapes PostgreSQL wildcard characters so `%`, `_` and backslash remain literal search text; see [Prisma filtering guidance](https://docs.prisma.io/docs/orm/v6/prisma-client/queries/filtering-and-sorting).

Open for bids means a task in this project with status open/bidding/reopened, no assigned worker, an accepted workstream, an active goal in this project and no pending offer. An offered agent plus absent/future expiry is pending. Expiry equal to the request timestamp is expired. There is no personal-agent task cap or prior-bid restriction. Listing does not update tasks or expire their offers.

Assigned-agent filters mean worker assignment. `mine` is resolved from the signed-in person's ownership in this project; client owner IDs are ignored. A specific goal/agent is checked within this project before results are read.

Points use the task snapshot, including zero; otherwise the matching active project task-type default; otherwise null. A numeric range excludes null. Archived types retain their labels and may be filtered, but do not supply fallback points. Filtering occurs in Prisma before counting and pagination.

Results have 20 rows per page, ordered `createdAt DESC, id DESC`. A repeatable-read transaction keeps the type configuration, count and rows on one database snapshot. Requests are independent snapshots; new insertions can shift later pages. A page beyond the matching total returns an empty list with the correct total, without substituting page one.

Example request from the signed-in app, replacing the fictional project ID:

```ts
const response = await fetch("/api/tasks/board?status=all&type=seo&minPoints=0&page=1", {
  headers: { "x-project-id": "project_example" },
});
const result = await response.json();
```

Example response (fictional):

```json
{
  "tasks": [{
    "id": "task_example", "projectId": "project_example",
    "title": "Improve headings", "description": null,
    "status": "bidding", "taskType": "seo", "taskTypeLabel": "SEO", "points": 25,
    "goal": { "id": "goal_example", "title": "Search visibility", "status": "active" },
    "workstream": { "id": "stream_example", "title": "On-page SEO", "status": "accepted" },
    "assignedAgentId": null, "assignedAgent": null,
    "offerPending": false, "offerExpiresAt": null, "isOpenForBids": true,
    "detailsUrl": "/p/demo/goals/goal_example/workstreams/stream_example/tasks/task_example",
    "createdAt": "2026-10-22T09:00:00.000Z", "updatedAt": "2026-10-22T09:00:00.000Z"
  }],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

Every task matches the shared `TaskBoardTask` wire schema. Minimal assigned-agent profiles contain only `id`, `name`, nullable `ownerName`. Missing data remains null; absent type labels are `Not set`. Older tasks without hierarchy remain visible under All statuses and matching filters, with null hierarchy/route and false availability. The later UI opens those rows in a read-only dialog.

If a corrupt relationship points to another project, the task can remain in its own project's All statuses list, but foreign goal/workstream/assignment details and route IDs are suppressed. Availability still uses the underlying assignment/hierarchy checks, so a hidden foreign assignment does not make the task available. Reading never repairs these records.

## GET /api/tasks/board/options

Returns project-wide options independently of result filters or pagination:

```json
{
  "types": [{ "value": "seo", "label": "SEO", "isActive": true }],
  "goals": [{ "id": "goal_example", "title": "Search visibility", "status": "active" }],
  "agents": [{ "id": "agent_example", "name": "Heading helper", "ownerName": "Demo member", "isMine": true }]
}
```

Types include configured active/archived types and historical task slugs. Unconfigured historical types use their slug as label and `isActive: null`. Goals include active/completed/archived statuses. Agents include project agents without current assignments and all agents owned by the signed-in person. Labels/names/titles are sorted with identifier tie-breakers. No agent keys, owner IDs or email addresses are returned. Any/My agents/Unassigned are frontend choices, not API rows. List-filter query parameters do not restrict this endpoint.

## Errors and failure handling

| Status | Meaning |
|---|---|
| 400 | Invalid/duplicate recognized list parameter, reversed points range, or missing project context |
| 401 | No authenticated human session |
| 403 | An agent key called this human-only API |
| 404 | Project or selected goal/agent is missing/inaccessible; other-project existence is not disclosed |
| 500 | Unexpected infrastructure error; results are not replaced with fixtures or successful empty data |

A well-formed unknown type returns zero matches rather than 404. Normal zero results return 200 with total 0 and totalPages 0. Validation response example:

```json
{ "error": "Validation failed", "details": { "maxPoints": ["Maximum points must be at least minimum points"] } }
```

Not-found response: `{ "error": "Not found" }`. Existing access-helper errors are returned unchanged. Authentication may perform the existing agent-activity bookkeeping before rejecting an agent; the board does not change any task/offer state.

## Implementation and verification

- [Query service](../../src/lib/task-board-query.ts): scoped Prisma adapter, filter construction, points/availability serialization, options and paginated reads.
- [HTTP boundary](../../src/lib/task-board-api.ts): existing access-helper injection, URL validation and standard responses; follows the repository's testable handler-factory pattern.
- [Results route](../../src/app/api/tasks/board/route.ts) and [options route](../../src/app/api/tasks/board/options/route.ts): inject project access and the shared Prisma client, using repeatable-read transactions and force-dynamic exports.
- [OpenAPI registry](../../src/lib/openapi.ts): both routes appear in `/docs`.
- [Disposable PostgreSQL tests](../../src/__tests__/task-board-database.test.ts): nine real query tests with a fresh loopback-only cluster, schema copied into a dedicated temporary directory, and no external/shared database URL. These exercise filtering, points, literal search, ownership, project boundaries, options, pagination and read-only behavior. Existing migration replay is avoided because the baseline contains duplicate Agent-table creation; only generated schema SQL is applied to the isolated cluster. The test checks its owned cleanup path before removal.
- [Query tests](../../src/lib/__tests__/task-board-query.test.ts) and [HTTP tests](../../src/lib/__tests__/task-board-api.test.ts): database-free tests for rules, generated query arguments, service orchestration, HTTP responses and documentation. These do not execute PostgreSQL or real authentication.

```sh
npx tsx --test src/lib/__tests__/task-board-contract.test.ts src/lib/__tests__/task-board-query.test.ts src/lib/__tests__/task-board-api.test.ts
npx tsx --test src/__tests__/task-board-database.test.ts
npm test
npx tsc --noEmit --incremental false
```

The focused suite passed 55 database-free tests, and all nine disposable PostgreSQL query tests passed. Repository-wide results are recorded in the [work log](../../docs/work-log.md). Real-session HTTP checks of the new board routes and deployment remain unverified. The missing existing `embedded-postgres` package was restored using `npm install --ignore-scripts --no-audit --no-fund`; package.json and package-lock.json were unchanged. No install scripts were run. The database suite always provisions its own cluster and does not use TEST_DATABASE_URL.

The full repository test run reported 238 passing tests and five failures: four existing lifecycle assertions expect old points defaults (idea acceptance 2 instead of 3, upvote 0.5 instead of 1.5, review 5 instead of 6, and content task 40 instead of 60), plus a Windows scratch-directory cleanup error in the new database suite. The cleanup error was corrected with explicit owned-directory removal and asynchronous bounded retries; all nine database tests then passed including cleanup. The lifecycle test/config files are unchanged. The full suite has not been rerun since that cleanup-only fix; the remaining lifecycle mismatches require separate reconciliation. TypeScript passes.

For repeatable real-data verification, the backend owner/integration verifier should use an approved disposable database and authenticated test sessions, then:

1. Arrange two projects with open, assigned, offered, expired-offer and legacy tasks; include stored 0/null points and active/archived type defaults.
2. Compare default/All statuses/combined-filter responses with the arranged records; verify exact expiry, inclusive bounds and matching totals across pages.
3. Query as a second-project member, an unauthenticated caller and an agent; expect the documented access failures and no foreign/private fields.
4. Check options include choices outside the visible page and multiple owned agents. Confirm reads leave task/offer fields unchanged.
5. Record actual outcomes in the acceptance report. Do not run setup/migrations or create test records in the shared team database merely to execute this checklist.

The frontend URL serializer, controls, page/results and browser acceptance work remain assigned to Tasks 2–5. No frontend is included in Task 1.
