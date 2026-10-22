# Task board filter controls

Task 3 implements controlled search, Status/Type/Goal/Assigned agent selectors, points bounds, active-filter chips and Reset. It does not fetch data, navigate, render task results or create a board page. Task 2 owns the page/results; Task 4 connects this component to committed URL state and the API.

## Component and handoff

Import [TaskBoardFilters](../../src/components/task-board/TaskBoardFilters.tsx) and its exported `TaskBoardFiltersProps`. These implement the original foundation interface without adding required props:

```ts
import { TaskBoardFilters } from "@/components/task-board/TaskBoardFilters";
import type { TaskBoardFiltersProps } from "@/components/task-board/TaskBoardFilters";
```

| Prop | Responsibility |
|---|---|
| `value: TaskBoardQuery` | Validated committed filters from the URL, including defaults/page |
| `options: TaskBoardOptions` | Independent project-wide choices, not current-page rows |
| `optionsLoading: boolean` | Shows loading status and disables dependent selectors |
| `optionsError: string \| null` | Shows an error and retry action while retaining selections |
| `fieldErrors` | Shared field-keyed validation messages from the parent |
| `onChange(patch, history)` | Apply a valid patch atomically; reset page to 1 in the parent |
| `onReset()` | Restore all default URL filters, including page 1 |
| `onRetryOptions()` | Retry choices through the parent request owner |

Mount with `key={projectId}` in Task 4's client. This discards old-project drafts and cancels their pending debounce even when both projects have identical filter values. Within one project, committed filter/page changes resynchronize the inputs for Back/Forward and direct URL changes.

For example, the integration owner supplies its current values and handlers:

```tsx
<TaskBoardFilters
  key={projectId}
  value={filters}
  options={options}
  optionsLoading={optionsLoading}
  optionsError={optionsError}
  fieldErrors={fieldErrors}
  onChange={applyFilterPatch}
  onReset={resetFilters}
  onRetryOptions={retryOptions}
/>
```

`applyFilterPatch` belongs to Task 4. Apply every supplied field together, including explicit `undefined` values that clear a selection/bound; do not drop them before merging with current state. The callback never sends page changes. Its `history` argument is `replace` for debounced typing and `push` for selectors/chips. Reset uses its own callback. No example here grants authorization to replace the teammate's controller or page.

## Behavior

- Status defaults to **Open for bids**. **All statuses** remains explicit. There is no second availability toggle.
- Search uses the existing SearchPill, trims outer whitespace, preserves inner text and allows at most 200 characters. Search and points emit valid changes after 300 ms without typing. Input-method composition delays search emission until composition ends.
- Min/Max points are independent, inclusive and may be empty. Zero remains zero. The shared schema validates whole numbers up to 2,147,483,647 and rejects reversed bounds.
- Points use numeric-keyboard text inputs to preserve invalid intermediate text, such as `-` or `1e2`, for validation. They do not silently turn an invalid number input's empty browser value into a cleared bound.
- Invalid drafts show field errors and explain that results still use the last applied filters. No callback is issued until the draft is valid. Other selector/chip changes are also held while drafts are invalid, unless that action clears the invalid points. Reset always recovers.
- A discrete selection flushes any valid pending search/points in the same callback, preventing an older timer from undoing that selection. Identical canonical drafts do not emit another typing patch. Duplicate callbacks are suppressed while waiting for the parent's committed value.
- Assigned agent means worker. Choices are Any agent, Unassigned, My agents, then project agents with owner names. My agents means assignments to any agent owned by the signed-in person; ownership is still enforced by the backend.
- Historical/archived types and completed/archived goals stay visible. Missing URL choices stay selected with an unavailable label, or a loading label while options are being fetched; the component never silently replaces them.
- Chips describe committed nondefault filters. No default-availability or pagination chip is shown. Removing a nondefault status restores Open for bids; clearing the points chip removes both bounds. Reset clears all local drafts immediately and asks the parent to reset the URL.

The existing Toolbar/SearchPill/PillSelect and installed field/input/button/badge/alert components are reused. SearchPill now accepts optional `inputProps` for IDs, validation references, length and composition events; PillSelect accepts optional `selectProps` for IDs, validation references and disabled state. Existing callers need no changes. No shared UI primitive or global design token was changed.

## Files and verification

- [Filter component](../../src/components/task-board/TaskBoardFilters.tsx): draft/debounce lifecycle, controlled inputs, messages, chips and callbacks.
- [Filter helpers](../../src/components/task-board/task-board-filter-state.ts): shared-schema draft validation, readable choices, chips and clear patches; no routing or requests.
- [Shared toolbar](../../src/components/Toolbar.tsx): small backward-compatible accessibility props.
- [Focused tests](../../src/lib/__tests__/task-board-filters.test.ts): numeric/search boundaries, atomic patches, null/zero/undefined handling, unavailable choices, historical labels and chip behavior.

```sh
npx tsx --test src/lib/__tests__/task-board-filters.test.ts src/lib/__tests__/task-board-contract.test.ts
npx tsc --noEmit --incremental false
npm test
```

No new dependency, environment variable or migration is needed. The helper/contract run passed 39 tests (24 new filter tests + 15 existing contract tests) and TypeScript passed. An isolated browser preview verified rapid typing/debouncing, zero values, invalid draft blocking and accessible errors, point-chip recovery, atomic discrete updates, unavailable selections, options retry/loading, Reset, external committed-state synchronization, project-key cancellation and keyboard focus. Desktop and a 390px mobile viewport were inspected; the mobile document had no horizontal overflow. The preview used fictional fixtures and callbacks only; it did not exercise Task 2's page, real API requests or browser history navigation. Actual input-method composition still requires a manual IME check after integration.

The full `npm test` run reported 217 tests: 213 passed and four existing lifecycle tests failed because their old points expectations differ from the unchanged current defaults (2 vs 3; 0.5 vs 1.5; 5 vs 6; 40 vs 60). No filter test failed. See the [work log](../../docs/work-log.md) for evidence and limits; do not infer complete page/API integration from helper tests or fixture previews.

Repeatable UI checks after Task 4 wiring: type quickly and inspect a single debounced replace; choose All statuses and refresh; enter 0/blank/reversed/fractional bounds; remove chips and Reset; load a missing goal/agent selection; retry failed options; use Back/Forward; switch projects with a pending draft; inspect labels/focus/errors on keyboard and mobile. Verify that production requests/routing come only from the parent.

After integrating the reviewed Task 1/2 contributions, the combined database-free board suite passes 95 tests. The updated standard `npm test` now discovers TSX component tests and reports 282 tests: 278 passed, the same four lifecycle points assertions failed, and none were cancelled. All nine disposable PostgreSQL board tests pass. The results/dialog components remain available; the page and sidebar entry are temporarily removed until Task 4 supplies the real controller.
