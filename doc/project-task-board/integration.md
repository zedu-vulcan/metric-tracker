# Project task board integration

Open **Tasks** in a project's sidebar, or visit `/p/<slug>/tasks`, for example `/p/zedu/tasks`. The restored page uses the real controller and existing backend; fixtures are never used as production fallback data. Previously the route was temporarily removed because its controller did not exist.

## Using the board

- The default view is **Open for bids**. Use **All statuses** to include assigned, completed and older tasks.
- Search title/description and combine Status, Type, Goal, Assigned agent and inclusive Min/Max points filters. Empty bounds are unrestricted; zero is valid.
- The URL holds applied filters and pagination. For example, `/p/zedu/tasks?status=all&agent=mine&minPoints=0` selects all statuses, your assigned workers, and known points of zero or more. Typing replaces the current history entry after the filter debounce; selections and pages push entries. Filter changes reset page to 1.
- Invalid or duplicate recognized URL parameters show an error and a Reset action instead of silently fetching default results. Unknown parameters are omitted from generated canonical navigation/share links.
- **Share view** copies the current project's canonical URL, including the current page. If clipboard access is denied or unavailable, a labeled read-only field remains available for manual copy. Focus it to select the link. Dismiss it explicitly, or change the committed view to clear it. Only the success announcement disappears automatically.
- Results and filter choices have separate loading/error/retry state. Retrying choices preserves loaded tasks and independent results errors. Retrying results preserves choices.
- Changing projects remounts the project-specific controller and filters. This discards old rows, errors, choices, dialogs, drafts and share state, cancels pending requests/timers, and ignores late responses from the previous project.

Normal task titles use the backend's supplied detail URL. Older tasks without a detail route open the existing read-only legacy dialog. Empty, error and out-of-range states remain owned by the results component.

## Implementation and boundaries

- [Page](../../src/app/p/[slug]/tasks/page.tsx): checks human project access with `getProjectPage`, uses the shared page layout, and mounts the controller keyed by project ID.
- [Navigation](../../src/components/SidebarNav.tsx): supplies the relative `/tasks` sidebar item.
- [Controller](../../src/components/task-board/TaskBoardClient.tsx): connects the existing URL helpers, filters and results; loads/validates results and options independently; keys its state by the project provider's ID.
- [URL helper](../../src/lib/task-board-url.ts): shared-parser entry point, canonical serialization, page-reset patches and share URLs.
- [Share lifecycle](../../src/lib/task-board-share.ts): prevents stale clipboard attempts/timers from replacing a newer result; keeps failed-copy links available.
- [Filter handoff](filters.md), [API guide](api.md) and [decisions](decisions.md): authoritative contracts and existing implementation details.

Existing Google sign-in, project membership and application development configuration are required to use the real page. No new dependency, environment variable or migration is introduced. Never use the shared database as a disposable test database.

## Repeatable checks

```sh
npx tsx --tsconfig tsconfig.test.json --test src/lib/__tests__/task-board-url.test.ts src/lib/__tests__/task-board-share.test.ts
npx tsc --noEmit --incremental false
npm test
```

The six share tests cover denied clipboard persistence, success timing, repeated attempts, stale clipboard completions, view reset and unmount cleanup. Existing URL tests cover round trips, duplicate/invalid values, explicit All statuses, zero bounds, page reset and share links.

With approved development configuration and the app running, repeat these browser checks:

1. Open the Tasks sidebar item and load the route directly. Confirm the default availability view, normal detail links and legacy dialog.
2. Combine filters including zero points, reload the URL, use Back/Forward, and navigate pages. Confirm filters/results follow the URL and filter changes return to page 1.
3. Let results succeed while the options request fails, then retry choices. Rows must stay visible. When both requests fail, retry choices and confirm the results error stays visible until results are retried.
4. Deny clipboard writes. The selectable link must remain after 1.8 seconds and through manual selection. Try success followed by failure; the previous success timer must not remove the newer fallback.
5. Delay a project's requests, switch project, and then finish the old requests. Only the new project's data may appear. Switch while a filter debounce or clipboard write is pending; old callbacks must not change the new project.
6. Open duplicate recognized parameters, such as `?status=all&status=open`, then use Reset. Check keyboard focus, mobile table scrolling, retry actions and share announcements.

## Verification limits

The repaired controller, actual filters and actual results were exercised together in an isolated browser preview using fictional API responses and navigation/project adapters. The retry, clipboard persistence, project cancellation, shared-value and invalid-URL scenarios passed. The automated URL/share tests and TypeScript passed at the initial repair checkpoint. The full `npm test` run reports 294 tests: 290 passed, the same four existing lifecycle points assertions failed, and none were cancelled. All nine disposable PostgreSQL board tests passed. Final TypeScript checking also passed. Details are recorded in the [work log](../../docs/work-log.md).

The preview does not establish real Next.js Back/Forward behavior, authenticated live HTTP access, production deployment or a complete real-data workflow. These still require final integration acceptance. Do not run `npm run build`, which applies database migrations. A full Next build was not used for these narrowly scoped repairs.
