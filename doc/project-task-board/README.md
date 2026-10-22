# Project task board: team foundation

Task 1 provides the [read-only board APIs](api.md). Task 2 supplies the results table and read-only legacy-task dialog; Task 3 supplies [controlled filters](filters.md). The `/p/[slug]/tasks` page and Tasks sidebar entry are temporarily removed because Task 4's `TaskBoardClient` does not exist yet. Task 4 must restore both when it connects URL state, API requests, filters and results. Sanmi owns integration and final verification.

## Start here

1. Read [decisions](decisions.md) for the agreed v1 behavior.
2. Give each coding agent the complete [agent context](agent-context.md), plus its human-assigned task, files and approved branch name.
3. Branch from the lead-published **`feat/project-task-board-clean`**, using this exact spelling. Individual task PRs target this branch. The lead handles eventual integration into main.
4. Import the shared contracts below. Do not create competing response types, filter names or parsers.

This replacement branch starts directly from verified main `5d4ef2d`. Only the eight reviewed Task 0 files were copied from the former integration branch; its commits were not merged or cherry-picked. The identified suspicious commit `78301a8` is excluded from this branch's ancestry. Startup scripts and PostCSS remain identical to the verified main baseline, and `api.js` and `branch_structure.json` are absent. This branch correction does not erase existing clones, cached objects or unrelated repository references. Use the lead-confirmed repository URL and this branch; do not restore the former integration history.

## Get only the approved branch

After Sanmi confirms publication, new team checkouts should use:

```sh
git clone --single-branch --no-tags --branch feat/project-task-board-clean https://github.com/zedu-vulcan/metric-tracker.git
```

This limits the checkout and normal fetch configuration to this branch's history and avoids fetching unrelated tags. Its ancestry excludes the identified suspicious commit. Do not broaden that fetch configuration, merge the former branch or restore old Git history. Existing clones can retain old objects even after branch deletion; this operation does not purge them. This is verification of the identified incident and replacement ancestry, not a repository-wide security certification.

## What exists

- [Shared schemas and inferred types](../../src/lib/schemas/task-board.ts): query validation, duplicate-aware URL parser, task/options/list response shapes, status values and pagination constants. These imports are safe for client code: they do not load Prisma or authentication.
- [Fictional fixtures](../../src/lib/fixtures/task-board.ts): a fresh factory for UI and contract tests, with zero/unknown/fallback points, worker ownership, pending/expired offers and a legacy task. No credentials or database connection is needed.
- [Contract tests](../../src/lib/__tests__/task-board-contract.test.ts): defaults, bounds, malformed/duplicate parameters and response validation. These do not prove a database query's availability or authorization logic.

```ts
import { parseTaskBoardQuery } from "@/lib/schemas/task-board";
import type { TaskBoardQuery, TaskBoardResponse, TaskBoardOptions } from "@/lib/schemas/task-board";
import { createTaskBoardFixtures } from "@/lib/fixtures/task-board";

const parsed = parseTaskBoardQuery(new URLSearchParams("status=all&minPoints=0"));
if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  // API: return 400 using the repository error shape. UI: display these errors.
}
const fixtures = createTaskBoardFixtures();
// fixtures.allStatusesResponse deliberately includes unavailable tasks.
// It must not be passed off as the default Open for bids API response.
```

Use `TaskBoardQuery` as the parsed state: `q` defaults to an empty string, `status` to `open_for_bids`, `page` to 1; the other filters are optional. `minPoints`/`maxPoints` become numbers. Use `parseTaskBoardQuery` at browser/API URL boundaries, because converting search parameters to an object first would hide duplicates. It ignores unknown keys. It validates syntax, not project membership or whether a selected goal/agent exists.

Pages are fixed at 20. `TASK_BOARD_MAX_PAGE` is 107,374,183 so the calculated database offset stays within a signed 32-bit integer. Higher pages produce validation errors; valid pages beyond the actual results return an empty list with the correct total. Type slugs use the existing lowercase letters/numbers/underscores format, maximum 60 characters. IDs are opaque, maximum 200 characters. `mine` and `unassigned` are reserved agent selectors.

Response schemas describe the wire format. The backend must still compute correct project-scoped availability, points, links, totals and ownership. In particular, schemas do not authorize reads or validate relationships. Never use fixtures as production fallback data.

## Ownership and handoff interfaces

Task 0 establishes the shared schemas, parser, fixtures and guides. Later contract changes go through Sanmi, then update code, fixtures, tests and guides together. Component names below are proposed handoff names to keep separate contributions compatible; Task 1 APIs, Task 2 results/dialog components and Task 3 filters now exist. Task 4 owns the remaining controller and restoring the page/navigation.

| Owner | Deliverable and boundary |
|---|---|
| Backend | `src/lib/task-board-query.ts`; `src/app/api/tasks/board/route.ts`; `src/app/api/tasks/board/options/route.ts`; board registrations in `src/lib/openapi.ts`. Consume shared schemas. Coordinate changes to them with the lead. |
| Page/results | `src/app/p/[slug]/tasks/page.tsx`; `src/components/task-board/TaskBoardResults.tsx`; legacy dialog and display states; minimal `/tasks` sidebar entry. |
| Filter controls | `src/components/task-board/TaskBoardFilters.tsx`; controls, validation messages, chips and Reset. No fetching or router ownership. |
| URL/integration | `src/components/task-board/TaskBoardClient.tsx`; `src/lib/task-board-url.ts`; canonical serialization, navigation, requests/cancellation and Share view. Reuse the parser already provided. |
| Verification | Cross-feature tests and acceptance evidence; coordinate fixture and guide changes with Sanmi. No competing API or UI implementation. |

`TaskBoardClient` owns committed URL state and fetching. It supplies:

- Filters: `value: TaskBoardQuery`, `options: TaskBoardOptions`, `optionsLoading: boolean`, `optionsError: string | null`, `fieldErrors: Partial<Record<keyof TaskBoardQuery, string[]>>`, `onChange(patch: Partial<Omit<TaskBoardQuery, "page">>, history: "push" | "replace"): void`, `onReset(): void`, `onRetryOptions(): void`. Search/points may keep temporary drafts; debounce valid typing for 300 ms. Filters never change pagination themselves; the integration callback resets it.
- Results: `data: TaskBoardResponse | null`, `loading: boolean`, `error: string | null`, `hasFilters: boolean`, `onPageChange(page: number): void`, `onRetry(): void`, `onReset(): void`. Render stale data only with a clear loading/error indication. Legacy dialogs use returned task fields. `hasFilters` means at least one nondefault selection/search/points bound, excluding pagination.

Keep invalid URL values visible in the client error state; do not replace them with valid defaults. Options are fetched independently of result-page rows. Share controls belong to the client/integration owner. Agree any interface adjustment before editing another owner's files. These interfaces do not authorize implementing another person's assignment.

## Verification

After installing the repository's existing dependencies:

```sh
npx tsx --test src/lib/__tests__/task-board-contract.test.ts
npm test
npx tsc --noEmit --incremental false
```

The focused suite is database-free. The full suite includes disposable PostgreSQL lifecycle tests, which require the existing `embedded-postgres` dependency and supported local setup. Never substitute the shared database. `TEST_DATABASE_URL`, if explicitly configured, must point to an approved disposable database. Do not run `npm run build`, which applies migrations. No new environment variable, migration or dependency is introduced by Task 0.

Actual verification results and remaining limits are recorded in the [work log](../../docs/work-log.md). Task 1 adds query/HTTP tests and [API usage documentation](api.md). The board still needs real-session HTTP verification, frontend URL/navigation/accessibility tests, and final real-data acceptance. The numbered team task list is a separate next deliverable.

## Temporary page removal and restoration

The reviewed Task 2 commit `469c2c0` imported a missing `TaskBoardClient`. Its results table, read-only legacy dialog and tests are retained, but the route and sidebar entry are removed to keep the branch compilable. Until Task 4 integrates the controller, `/p/[slug]/tasks` has no page.

Task 4 restores `src/app/p/[slug]/tasks/page.tsx` with `getProjectPage`, `PageHeader`, `PageContent` and the real project-keyed controller, then adds the relative `/tasks` item back to `SidebarNav`. Do not use fixtures as a production fallback. Connect both existing component interfaces, validate URL and API behavior, and rerun TypeScript and `npm test`. The standard test script now includes TSX tests using `tsconfig.test.json`; the 16 results/dialog tests must be discovered. Real-session and interactive integration checks still belong to Tasks 4/5.
