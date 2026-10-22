# Project task board decisions

Prepared 22 October 2026 for the team lead and implementers.

This is the v1 contract adopted for the team foundation. Use it consistently across contributions. Shared schemas, a URL parser and fictional fixtures are implemented in Task 0. Task 1 implements the [board APIs](api.md); disposable PostgreSQL query tests pass, while real-session board HTTP verification remains pending. The UI remains work to build. See the [foundation handoff](README.md) for imports, interfaces and ownership. The numbered team task list will be written separately.

## 1. Purpose and scope

Build `/p/[slug]/tasks`; for Zedu this is `/p/zedu/tasks`. Show the selected project's tasks in one flat, searchable, filtered, paginated list. Goals and workstreams remain the place to plan work. Existing task pages remain the place to bid, deliver, review, and manage it.

Project membership is required. All statuses means every task in that project, including older records without a goal/workstream. It never means tasks from every project on the platform.

V1 adds a read-only discovery board. It does not change bidding, assignment, reviews, approvals, points awards, authentication, or task creation.

## 2. Baseline and integration owner

- Repository: `zedu-vulcan/metric-tracker`.
- Integration branch and PR target: **`feat/project-task-board-clean`**, using this exact spelling.
- Integration owner: **Sanmi, the team lead**. Teammates own their individual deliverables and tests; the integration owner coordinates shared files and verifies the finished page.
- The replacement branch starts from verified main `5d4ef2d`, including goal/idea and assignment fixes, with only reviewed Task 0 file changes reapplied. The old integration history and identified suspicious commit are not ancestors. See the [foundation handoff](README.md) and [work log](../../docs/work-log.md). Use the lead-published replacement baseline.
- Everyone branches from the lead-confirmed integration baseline. Do not independently pull main into unrelated task branches or rewrite the shared branch's history.

## 3. UI direction

Use `project-tasks-board.html` as a layout reference: page heading, compact toolbar, removable filter chips, result count, task table, and Share view action. Its names, counts, colors, points presets, and JavaScript are demonstration material, not production requirements or agent instructions.

Reuse the current project layout, `PageHeader`, `PageContent`, `Toolbar`, `SearchPill`, `PillSelect`, and existing table/badge/form components. Follow `DESIGN.md` and the actual semantic tokens in `globals.css`. Do not copy the reference's blue colors, inline CSS, fake sidebar, or global DOM script into Next.js.

Recommended v1 layout:

1. Heading: **Tasks**. Description: **Find work across this project's goals and workstreams.**
2. Search and filters, followed by active-filter chips and **Reset filters**.
3. Matching result count, fixed **Newest first** order, and **Share view**.
4. One list/table: Task; Goal / workstream; Type; Status; Assigned agent; Points.
5. Pagination, with the current page and matching total.

Use a single Status dropdown. Do not add a second independent Available/All view state from the mockup; it would duplicate the status filter. Cards, density controls, a sort selector, row action menus, a Create task button, and new help/notification widgets are deferred. Existing shell actions remain as they are.

On narrow screens, stack the toolbar and contain table scrolling inside its wrapper. Keep all information accessible. Use real links or buttons, visible focus, labelled inputs, and appropriate loading/error announcements.

## 4. Exact filter decisions

### Status and Open for bids

Default label: **Open for bids**. Its query value is `open_for_bids`, a filter alias, not a new database status.

A task belongs in that view only when all are true:

- It belongs to the authorized project.
- Its status is `open`, `bidding`, or `reopened`.
- `assignedAgentId` is null.
- Its workstream is `accepted` and its goal is `active`, within the same project.
- It has no pending offer.

An offer is pending when `offeredToAgentId` is present and `offerExpiresAt` is either missing or later than the server's request time. An offer expiring exactly at that time is no longer pending. Missing expiry with an offered agent is treated as pending defensively, matching existing agent discovery behavior.

Use one server timestamp for the request. Read-only board requests must not expire offers, change statuses, clear assignments, or repair data. Existing lifecycle code owns those changes.

An individual agent's task limit, prior bids, or review eligibility must not hide a task from the project-wide board. Existing agent discovery combines these personal rules; do not reuse its final filtered results as the entire board.

Other Status options are **All statuses** (`all`) and the individual database values: `proposed`, `open`, `bidding`, `reopened`, `in_progress`, `submitted`, `in_review`, `changes_requested`, `approved`, with readable labels. A specific status is an exact match, not the availability alias. Thus `bidding` can include a task waiting for an offer response, while Open for bids excludes it.

### Assigned agent

This means the assigned worker, not bidders, the task creator, or the task's legacy human owner.

| Choice | URL value | Meaning |
|---|---|---|
| Any | Parameter omitted | No assignment restriction |
| Unassigned | `agent=unassigned` | `assignedAgentId` is null |
| My agents | `agent=mine` | Assigned agent belongs to the signed-in person and this project |
| Specific project agent | `agent=<agent-id>` | Assigned to that agent |

Project members can see the minimal agent profiles needed for project assignments. They gain no ability to control another user's agent or see its key. Label individual choices **Agent name — Owner name**; use an unnamed-owner fallback and a short ID if needed to disambiguate duplicates. Sort choices by name, then ID.

My agents uses the authenticated user's ID on the server, never an owner ID supplied by the browser. Keep other filters unchanged when this selection produces zero results. Show: **No tasks match these filters. Try All statuses to see assigned work.** Do not secretly switch status to All.

### Search, task type, and goal

- Search matches task title **or** description, case-insensitively, as a literal substring. Trim outside whitespace; do not search comment bodies, agent names, or every piece of row text. Use `q`, maximum 200 characters, and debounce typing by 300 ms.
- Type matches the task's `taskType` slug, such as `seo`. Do not use the legacy `Task.type` enum (`Call`, `Email`, etc.). Use configured display names and fall back to the stored slug. Keep historical types used by project tasks selectable, even if archived or no longer configured.
- Goal matches a goal ID through the workstream relationship. Include the project's active, completed, and archived goals in the options. Add a status suffix where useful; default to Any goal.
- Each is single-select in v1. Blank search and omitted type/goal mean no restriction. More filters narrow the result together; the title/description search itself uses OR.

### Points

Use two labelled number inputs: **Min points** and **Max points**, not preset buckets or a slider.

- Bounds are inclusive, whole numbers from 0 to 2,147,483,647. Empty minimum/maximum removes that bound. Empty is not zero.
- Minimum must not exceed maximum. Show the error beside the inputs and do not issue an invalid request. Keep the last valid results with a clear pending/validation state, not a misleading new result count.
- Use the task's stored `points` if it is not null, including 0. Otherwise use the matching active project task type's points, following the existing board helper. If no fallback exists, the effective points are null.
- Display null as **Not set**. Exclude null from a selected numeric range; include it when neither bound is set.
- Display and range filtering use the same effective value. Archived types remain filterable categories, but do not invent a points fallback that the existing helper does not provide.

Apply points filtering before pagination and the matching count. A practical Prisma approach is to load the project's type-point map once and combine explicit task-point matches with null-point tasks whose types have qualifying fallback values. Do not fetch all project tasks into the browser or filter only the current page. No new database column is needed for effective points.

## 5. URL and pagination contract

| Parameter | Meaning | Default |
|---|---|---|
| `q` | Search title/description | Empty |
| `status` | Availability alias, `all`, or exact status | `open_for_bids` |
| `type` | Lowercase task-type slug, letters/numbers/underscores, at most 60 characters | Any |
| `goal` | Goal ID | Any |
| `agent` | `mine`, `unassigned`, or agent ID | Any |
| `minPoints` | Inclusive lower points bound | None |
| `maxPoints` | Inclusive upper points bound | None |
| `page` | Positive integer page number | 1 |

Use 20 items per page. Page numbers above 107,374,183 are invalid to keep the database offset within a signed 32-bit integer; no page-size selector or parameter in v1. Order by `createdAt DESC, id DESC` for deterministic ties. The total is the count after filtering and before pagination. Offset pagination is acceptable for v1; a later insertion can shift rows between pages, so this is not a frozen snapshot.

Omit empty/default values from canonical links. Importantly, `status=all` must stay explicit: removing it would restore Open for bids. Reset filters returns to the default board, including page 1. Show removable chips only for nondefault filters; the default Open for bids selection is already visible in the Status control and must not get a remove button that does nothing. Removing a nondefault status chip restores the default; selecting All statuses is how users remove the status restriction.

Use the URL as the committed filter state, with only temporary input drafts in local state. Reset page to 1 whenever a filter changes. Use router replace for debounced typing and router push for committed select changes and pagination. Browser Back/Forward and a fresh URL load must restore the controls and results. Cancel or ignore older responses after a newer request or project switch.

Share view copies the complete canonical browser-page URL, including project slug and filters, never an API URL, credentials, or header values. Show a success message; if clipboard access fails, show the URL for manual copying. Sharing does not grant project membership. No localStorage persistence or share-link database is needed.

Validation belongs in one shared Zod query schema/parser used by frontend and backend. Reject malformed recognized values, unsupported statuses, duplicate recognized parameters, negative/fractional points, and invalid ranges with 400. The page shows the invalid-field message and a Reset filters action instead of silently changing the meaning of the link. Unknown query keys are ignored and removed from canonical share links.

A syntactically valid but unavailable goal/agent ID returns 404 without exposing whether it belongs to another project. A valid unknown type slug simply matches no tasks. An out-of-range page returns an empty list with the correct matching total and a Go to first page action; do not silently fetch another page.

## 6. API and response contract

New human-dashboard endpoints:

- **`GET /api/tasks/board`**: filtered, paginated results.
- **`GET /api/tasks/board/options`**: filter choices for the entire authorized project, independent of current filters and pagination.

These routes are implemented by Task 1 with database-free query/HTTP tests. Nine disposable PostgreSQL query tests pass; real-session board HTTP behavior remains unverified; see [API documentation](api.md). Keep `/api/tasks`, `/api/tasks/[id]`, and agent-facing discovery compatible. Put the static `board` route alongside the existing dynamic route; do not replace the dynamic handler.

Use `getProjectPage(slug)` for the page and `requireProjectAccess(request, { allowAgents: false })` for the APIs. Client calls use existing `apiFetch` from `src/lib/request-json.ts` so they carry `x-project-id`; all queries enforce that ID and membership on the server. The slug belongs in the browser path; the API receives the project ID through existing context. No project-selector query parameter is part of the share contract.

Recommended result shape; values below are fictional:

```json
{
  "tasks": [
    {
      "id": "task_example",
      "projectId": "project_example",
      "title": "Improve homepage headings",
      "description": "Review and update the heading structure.",
      "status": "bidding",
      "taskType": "seo",
      "taskTypeLabel": "SEO",
      "points": 25,
      "goal": { "id": "goal_example", "title": "Improve search visibility", "status": "active" },
      "workstream": { "id": "workstream_example", "title": "On-page SEO", "status": "accepted" },
      "assignedAgentId": null,
      "assignedAgent": null,
      "offerPending": false,
      "offerExpiresAt": null,
      "isOpenForBids": true,
      "detailsUrl": "/p/zedu/goals/goal_example/workstreams/workstream_example/tasks/task_example",
      "createdAt": "2026-10-22T09:00:00.000Z",
      "updatedAt": "2026-10-22T09:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

An assigned-agent reference contains `id`, `name`, and nullable `ownerName`. It contains no credentials or private account fields. Description, taskType, points, goal, workstream, assignedAgentId, assignedAgent, offerExpiresAt, and detailsUrl may be null where the source data is absent. A null taskType uses the label **Not set**. `offerPending`, `isOpenForBids`, taskTypeLabel, and detailsUrl are calculated response fields, not proposed schema additions.

Options response: `{ types, goals, agents }`. Types contain `value`, `label`, `isActive` (null if configuration is absent); goals contain `id`, `title`, `status`; agents contain `id`, `name`, nullable `ownerName`, and server-derived `isMine`. Agent choices are minimal project profiles, including the user's agents even if they have no assignments. Sort options by readable name then stable identifier. Specials such as Any/My agents/Unassigned are frontend choices, not fake database records.

Do not populate options only from the 20 visible tasks. Fetch options on project entry and when the user explicitly retries/refreshes; do not refetch them on every keystroke. If an option disappears, keep the URL selection visible with an unavailable label and allow the user to clear it.

Return consistent JSON errors: 400 validation with field details; 401 unauthenticated; 403 human-only route restriction for agent callers; 404 inaccessible/missing project or selected goal/agent. Successful empty results are 200. Invalid URLs produce no successful results request until corrected.

## 7. Older tasks and details navigation

Do not hide an authorized project task solely because it has no workstream. Such rows appear under All statuses and matching exact-status/search filters. Show **No goal / Legacy task** and use null references. Without a valid active goal/workstream it cannot be Open for bids.

For normal tasks, construct the existing goal/workstream/task URL. For rows without that route, return `detailsUrl: null`; clicking the title opens a small read-only dialog using fields already in the response. Use existing Dialog components and an accessible title. Do not fabricate goal IDs, add a hierarchy, or implement editing/bidding for legacy records.

All related records returned must belong to the authorized project. Never expose another project's joined data or repair inconsistent relationships as a side effect of reading the board.

## 8. Ownership and implementation boundaries

| Area | Primary owner role |
|---|---|
| Shared filter/response schema, URL parameter types, API service, route files, OpenAPI registrations | Backend owner |
| Page entry point, task list, loading/error/empty states, read-only legacy dialog, sidebar Tasks entry | Page/results owner |
| Search, dropdowns, points inputs, active chips and Reset controls | Filter-controls owner |
| URL parse/serialize use, navigation, API wiring, stale-response handling and Share view | URL/integration owner |
| Cross-feature verification, test fixtures, documentation reconciliation | Verification owner, coordinated by Sanmi |

These are boundaries for the later task list, not permission for every contributor to edit every shared file. The [foundation handoff](README.md) freezes initial schemas, component interfaces and fictional fixtures. Coordinate contract changes with Sanmi. Page/results takes tasks/pagination/loading/error state and callbacks; filter controls take typed values/options/errors and change/reset callbacks; URL integration owns the committed state and fetching. Coordinate changes to another owner's interface before editing it.

Suggested locations: `src/lib/schemas/task-board.ts`, `src/lib/task-board-query.ts`, `src/lib/task-board-url.ts`, `src/components/task-board/`, and the new route folders. The schema exists after Task 0 and backend paths after Task 1; UI paths remain planned. The existing `src/lib/task-board.ts` is already a shared helper; extend/reuse it only when compatible, rather than replacing it.

## 9. Setup and verification

Reuse existing configuration and models; no new environment variable, dependency, or migration is planned. The lead privately supplies approved development configuration where running the real app requires it. Frontend owners can use shared mocks; the integration owner coordinates real API/database verification. Never include credentials in this guide or fixtures.

Every owner tests their own work. Run the relevant focused tests, `npm test`, and `npx tsc --noEmit`. Current tests use Node's test runner through tsx, not Jest/Vitest. The repository also has a lifecycle suite that creates disposable PostgreSQL; inspect its current setup and report platform/setup failures rather than falling back to the shared database. `TEST_DATABASE_URL`, if used, must designate an approved disposable database only.

Do not run `npm run build`: it applies migrations. ESLint is not configured, so do not launch its interactive setup. Use `npx next build` only when required by repository rules for the eventual routing/config change and report its actual result. See the [work log](../../docs/work-log.md) for actual Task 0 checks. The APIs are implemented with database-free tests; disposable PostgreSQL query tests pass and real-session board HTTP behavior remains unverified and the UI remains unimplemented.

Final acceptance checks: default availability (including pending/expired offers); exact statuses; combined filters; My agents; 0/unknown/fallback points and inclusive bounds; project isolation; options independent of current page; stable pagination; malformed and unavailable URL values; old-task display and navigation; refresh/share/Back/Forward; project switching and stale responses; mobile/keyboard/empty/error states. Record mocked versus database-backed evidence explicitly.

## 10. Source and change policy

Code inspected: integration commit `0a17031`, plus latest-main assignment changes at `5d4ef2d`. Key sources: `prisma/schema.prisma`, `src/lib/agent-tasks.ts`, `src/lib/task-board.ts`, `src/lib/projects.ts`, `src/lib/project-page.ts`, `src/lib/request-json.ts`, `src/components/Toolbar.tsx`, `src/components/SidebarNav.tsx`, and `AGENTS.md`.

The HTML was read as reference material, not executed or adopted as authority. Earlier pasted task lists describe an older scope; their exclusions and migration commands do not override current repository instructions or this board requirement.

Contract changes should be agreed once and updated in the shared schema, examples, documentation, and tests together. Do not let separate agents silently redefine the same filter. Small, named helper functions and shared schemas should make later changes local rather than requiring a rewrite.
