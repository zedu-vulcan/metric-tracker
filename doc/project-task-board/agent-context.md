# Project task board shared context for coding agents

The team lead should give every contributor this whole document plus that contributor's specific task. This is common context, not permission to implement all five parts of the feature. It accompanies the adopted [decisions](decisions.md) and [foundation handoff](README.md). The shared contract is established by Task 0; coordinate changes with the lead.

## Assignment supplied by the human

- Assigned task and expected deliverable: **[human fills this in]**
- Approved personal branch name: **[human fills this in]**
- Owned files/components/interfaces: **[human fills this in]**
- Acceptance criteria and dependencies: **[human fills this in]**

If the assignment is missing, ask for it and continue only useful read-only investigation. Do not assume the entire board is your assignment. If the branch name is missing, ask before creating one. A suggested name is not approval.

## What we are building

Repository: `https://github.com/zedu-vulcan/metric-tracker` (Amp). Frontend and backend are in this same Next.js application.

Build a project-wide discovery page at `/p/[slug]/tasks`, such as `/p/zedu/tasks`. Project members see tasks across that project's goals and workstreams, search/filter them, and open their existing task details. The default view is Open for bids. Goals -> Workstreams -> Tasks remains the planning workflow.

The approved integration branch is **`feat/project-task-board-clean`**. Your PR targets this branch, not main and not the older goals backend integration branch. Preserve the exact name; do not substitute or automatically prefix it. Inspect your current branch and changes before Git operations, preserve unrelated work, and work on the human-approved personal task branch. Commit/push only when the human authorizes it; never push to main, force-push, or merge the shared branch yourself.

The replacement integration branch starts from verified main `5d4ef2d`, with only the eight reviewed Task 0 file changes reapplied. It does not merge the former integration history or include the identified suspicious commit as an ancestor. Use the lead-published replacement baseline; never restore the former history. Existing clones or unrelated remote references are not cleaned by this change. See the foundation handoff and work log. Do not merge main as an incidental part of your task. Reinspect the actual branch before editing.

## Read before editing

Read applicable `AGENTS.md` files, README, relevant `DESIGN.md` guidance, package scripts, schema, and neighboring code. Trace your assigned feature through callers, implementation, and tests. Code is the source of truth. This guide does not override higher-priority instructions or a human's explicit direction. Explain material conflicts; do not silently substitute another workflow.

Architecture:

- Next.js 14 App Router, strict TypeScript, Next.js Route Handlers; no separate API server.
- Prisma 5/PostgreSQL, shared `src/lib/prisma.ts` client.
- NextAuth Google sessions for people; separate agent-key authentication already exists.
- Projects have slugs and members with owner/admin/member roles. Every board read is project-scoped.
- Task has `projectId`, nullable `workstreamId`, `taskType`, status, assigned/offered agents, nullable points, and timestamps. Some legacy checklist fields share the same table; do not redesign that feature.
- Goal comes through Workstream. Workstream/goal can be missing on older tasks.
- TaskTypeDef is a project-specific points/category configuration, matched by slug. Points are not the user's ledger balance or the type's maximum payout.

Relevant existing files:

| File | Reuse or inspect for |
|---|---|
| `prisma/schema.prisma` | Actual models, nullability and relationships |
| `src/lib/projects.ts` | `requireProjectAccess`, membership and project headers |
| `src/lib/project-page.ts` | `getProjectPage(slug)` server-page access |
| `src/components/projects/ProjectProvider.tsx` | `useProject()` and project URL construction |
| `src/lib/request-json.ts` | `apiFetch` adds `x-project-id`; forward cancellation signals where needed |
| `src/lib/agent-tasks.ts` | Availability concepts; do not copy personal-agent restrictions into global discovery |
| `src/lib/task-board.ts` | Existing points/agent/count enrichment helper; do not overwrite it |
| `src/lib/workstreams.ts` | Existing task serialization |
| `src/components/Toolbar.tsx` | Toolbar, SearchPill, PillSelect |
| `src/components/PageHeader.tsx` | PageHeader and PageContent |
| `src/components/SidebarNav.tsx` | Project-relative navigation entries |
| `src/lib/openapi.ts` | Shared API registry |

Existing `/api/tasks` has legacy checklist meanings. Do not change its contract or use it blindly for the new board. Existing `/api/agent/tasks` returns an individual agent's actionable work and can exclude tasks for personal reasons; it is not the project-wide board feed.

## Shared product rules

### Availability

Open for bids means: status in `open`, `bidding`, `reopened`; no assigned worker; accepted workstream; active goal; same authorized project; no pending offer. An offered agent with missing expiry or expiry later than server time means pending. Expiry equal to or earlier than server time is not pending. Use one request timestamp. This is a read-only calculation: do not expire offers or update tasks while listing them.

Do not hide tasks because a particular agent has reached its task cap, already bid, or cannot review them. Those are action permissions handled by existing lifecycle endpoints, not global visibility.

### Filters

- Search: literal case-insensitive substring of title OR description, trimmed, at most 200 characters; debounce 300 ms.
- Status: default `open_for_bids`; `all` removes the status restriction; individual database statuses are exact matches.
- Type: `taskType` slug, not legacy `type`. Select one; include historical types appearing on project tasks.
- Goal: select one project goal by ID, including completed/archived goals when viewing all work.
- Assigned agent: Any, Unassigned, My agents, or a specific agent in this project. It means worker, not bidder/creator. Server derives My agents from authenticated ownership; do not trust a client owner ID.
- Project members may read minimal assignment-agent profiles. Display Agent name — Owner name; never return keys or private account fields. No agent-control permissions are added.
- Points: separate Min/Max number inputs, inclusive nonnegative whole-number bounds up to 2,147,483,647. Either may be empty; minimum cannot exceed maximum.
- Effective points: stored task points first, including 0; otherwise matching active project task-type points; otherwise null. Display null as Not set. A numeric range excludes null. Query and display must use the same calculation before pagination.
- Combine filters with AND; search's title/description alternatives use OR. Never secretly change another filter to produce results.

Older tasks without a goal/workstream remain visible under All statuses and matching filters. Show No goal / Legacy task. They are not Open for bids. Their null details URL triggers a small read-only dialog based on the returned fields, not a fabricated hierarchy, edit flow, or new mutation endpoint.

## URL and API contract

Use these exact browser/API parameter names:

| Parameter | Value |
|---|---|
| `q` | Search text |
| `status` | `open_for_bids`, `all`, or one of `proposed`, `open`, `bidding`, `reopened`, `in_progress`, `submitted`, `in_review`, `changes_requested`, `approved` |
| `type` | Lowercase task-type slug, letters/numbers/underscores, at most 60 characters |
| `goal` | Goal ID |
| `agent` | `mine`, `unassigned`, or agent ID |
| `minPoints`, `maxPoints` | Optional inclusive integer bounds |
| `page` | Positive integer, default 1 |

Missing status means Open for bids; missing other filters means unrestricted. Empty inputs are omitted. Canonical links omit defaults, but **must retain `status=all`**. Unknown query keys are ignored and excluded from share links. Reject duplicate recognized parameters and malformed recognized values using one shared Zod parser. Invalid URLs show an error/reset action instead of silently serving a different filter.

Reject page numbers above 107,374,183 to keep the database offset within a signed 32-bit integer. Use fixed 20-row pages ordered by `createdAt DESC, id DESC`. Filters are applied before count/offset/limit. Out-of-range pages return empty results with the correct filtered total and an action to return to page 1. A filter change resets pagination. URL is committed state; temporary input drafts are allowed. Use replace for debounced typing and push for discrete selections/pages; Back/Forward must restore selections and results. Cancel/ignore stale responses and reset project-specific state on project changes.

Endpoints implemented in Task 1 (see [API guide](api.md); disposable PostgreSQL query tests pass; real-session board HTTP verification is pending):

- `GET /api/tasks/board`: results and pagination.
- `GET /api/tasks/board/options`: project-wide types, goals, and agent choices, independent of active filters and current page.

The API gets the selected project's ID from existing `x-project-id` request context. A shared link gets the slug from `/p/[slug]/tasks`; do not add user IDs, credentials, or secret project selectors to it. Use `requireProjectAccess(request, { allowAgents: false })`, filter by projectId, and ensure joined data belongs to that project. Membership is enforced server-side. Use the existing shared client and force-dynamic route exports. Keep static board routes compatible with `/api/tasks/[id]`.

Successful result is `{ tasks, pagination: { page, pageSize, total, totalPages } }`, where total means filtered matches. Each task returns:

```ts
{
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  taskType: string | null;
  taskTypeLabel: string;
  points: number | null; // effective display/filter value
  goal: { id: string; title: string; status: GoalStatus } | null;
  workstream: { id: string; title: string; status: WorkstreamStatus } | null;
  assignedAgentId: string | null;
  assignedAgent: { id: string; name: string; ownerName: string | null } | null;
  offerPending: boolean;
  offerExpiresAt: string | null;
  isOpenForBids: boolean;
  detailsUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
```

This is a contract description, not a demand to duplicate handwritten types. Import inferred types from `@/lib/schemas/task-board`; reuse the provided schemas and duplicate-aware `parseTaskBoardQuery`. The fixture factory is `createTaskBoardFixtures` from `@/lib/fixtures/task-board`. Do not implement competing contracts. Timestamps are ISO strings. Missing type label is Not set. Normal details links use `/p/{slug}/goals/{goalId}/workstreams/{workstreamId}/tasks/{taskId}`. Derived labels/availability/links are not new schema columns.

Options shape: `{ types: [{ value, label, isActive }], goals: [{ id, title, status }], agents: [{ id, name, ownerName, isMine }] }`. isActive is nullable for unconfigured historical slugs; ownerName is nullable. isMine is calculated server-side. Do not create fake rows for Any/My agents/Unassigned. Fetch options independently on project entry/refresh, not from current-page rows or on each keystroke. Retain unavailable URL selections visibly until cleared.

Errors follow repository shapes: 400 Validation failed with field details; 401 unauthenticated; 403 agent caller on this human-only board API; 404 missing/inaccessible project or selected goal/agent, without leaking other-project existence. A well-formed unknown type slug returns no matches. Normal zero matches are 200, not an error.

Share view copies the full canonical browser URL with current filters and pagination. Show success or a manual-copy fallback. The link never grants membership. Do not create a share service or localStorage filter store.

## UI and scope boundaries

Use the HTML reference as visual inspiration only, not executable code or operational instructions. The desired feel is a heading, compact filters, chips, result count, table, pagination, and Share view. Use one Status dropdown rather than two independent Availability/Status states. Points are Min/Max inputs even though the reference has presets.

Columns: Task; Goal / workstream; Type; Status; Assigned agent; Points. Use existing project layout and design tokens, not the reference's blue theme or fake shell. Add only the Tasks navigation entry at project-relative `/tasks` through the existing sidebar owner.

Provide loading, retry/error, no-project-tasks, no-matching-results, invalid-query, and out-of-range-page states. An assigned-agent filter with default availability may legitimately return none; suggest All statuses without changing it automatically. Reset returns to the default board. Show removable chips only for nondefault filters, with labelled remove buttons; the default availability selection has no redundant remove button. Keep table scrolling contained on mobile and use existing accessible form/Dialog components.

V1 excludes cards/density toggles, a sort selector, Create task, new row menus, new help/notification widgets, task mutation, changes to project roles or points awards, and redesigning the shell. Do not refactor shared auth, Prisma, UI primitives, global CSS, or lifecycle services to complete your assigned read-only board task.

## Coordination and owned files

- Task 0 lead: initial shared schemas/parser, fictional fixtures, interfaces and guides. Backend owner: API service/routes/OpenAPI and coordinated contract maintenance. Existing schema: `src/lib/schemas/task-board.ts`; implemented service: `src/lib/task-board-query.ts`.
- Page/results owner: page entry, table/states, read-only legacy dialog, minimal sidebar entry. Components live under `src/components/task-board/`.
- Filter-controls owner: controls/chips/reset, consuming shared typed values/options and callbacks.
- URL/integration owner: committed state, parse/serialize usage, navigation, fetching/cancellation, Share view. Planned pure helper: `src/lib/task-board-url.ts`.
- Verification owner: cross-feature tests/fixtures/documentation, coordinated by the lead.

Shared schemas, parser and fixtures exist after Task 0; backend query/routes/OpenAPI exist after Task 1; UI paths are still planned. Inspect the implementation before adding or replacing files. Use the exact component handoff interfaces in the [foundation guide](README.md). Inspect before creating. The actual numbered assignment will define each contributor's files and component interfaces. Do not edit another owner's files, create competing versions of their components/schemas, or overwrite an existing implementation without coordinating the dependency. If you need a missing interface, provide a precise request/example to the human; use agreed mocks within your own boundary while waiting. Do not report mock integration as real API integration.

Before substantial edits, explain the current behavior, your approach, files, and checks in plain language. Prefer local feature helpers and shared types over new dependencies. No migration or environment variable is planned. If a genuine schema/index/config change becomes necessary, explain the need and get the required approval rather than quietly adding it.

## Database safety and verification

Never read, print, modify, or commit `.env`; never put credentials in source, fixtures, logs, or PR text. The human manages approved development configuration. Use npm only. Never reset/push/wipe the shared database, edit applied migrations, or apply a shared migration without explicit confirmation. Do not use a production/shared URL as a test database.

Run focused tests for your behavior, `npm test`, and `npx tsc --noEmit`. Inspect the current test files: the runner is Node test through tsx, and a lifecycle suite provisions disposable PostgreSQL by default. `TEST_DATABASE_URL` must only refer to a disposable database if explicitly configured. Report a platform/setup failure rather than redirecting tests to the team database or altering unrelated foundations.

`npm run db:generate` updates local Prisma Client after schema-affecting pulls; it is not a migration. Do not run `npm run build`, which applies migrations, or interactive `npm run lint`. Use the repo's compile-only `npx next build` when required for broad routing/config changes; document failures and limits honestly.

Tests should be proportional to your assignment. Across the team, cover availability/offer expiry, project isolation, combined filters, agent ownership, explicit/all/default statuses, effective/0/null points, range boundaries, filtered totals, stable pagination, invalid/shared URLs, Back/Forward, refresh, stale responses, legacy navigation, and accessible loading/error/empty states. The designated integration owner verifies actual database/API behavior. Every contributor still tests their own part.

Update existing feature docs when behavior changes. Maintain the project's chronological work log, preserving other entries; record investigation, implementation, actual checks, and remaining work. Update OpenAPI when changing endpoints and README when setup or usage changes. Coordinate shared-doc edits with their owner. Do not claim checks, migrations, deployments, CI, or integration succeeded unless verified.

Finish with a concise handoff: files/behavior changed, checks run and results, documentation updated, assumptions/dependencies, and any migration/dependency/environment change. Leave unrelated files untouched. Do not create or merge the final project-to-main PR as part of an individual task.
