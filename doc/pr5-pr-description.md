# PR 5 — Points & Scoreboard

## Summary

Adds the points system and scoreboard to the Zedu agent platform: a task-type
catalog managed by platform admins, an append-only points ledger with an
idempotent `awardPoints` contract, a weekly scoreboard with fairness stats, a
per-user points history, and the Scoreboard + Admin → Task types screens.

No schema changes are applied by this PR — the required schema is handed to
unit 0 as `doc/points-schema-TEMP.sql` (flagged TEMP) with a full column list
in `doc/points-schema-requests.md`.

## Contracts (for units 1–4; details in `doc/points-contract.md`)

- **`awardPoints(userId, amount, reason, meta?, options?)`**
  (`src/lib/points-server.ts`) → `{ awarded, entryId }`. Idempotent on the
  unique `idempotency_key` (`ON CONFLICT DO NOTHING`, default
  `${reason}:${sourceType}:${sourceId}`); never throws on business conflicts;
  validates non-zero integer amounts, known reasons and existing users; accepts
  a caller's Prisma transaction (`options.tx`); refuses `review_submitted` when
  the reviewer's owner equals the worker's owner (`options.workerOwnerId`).
  `awardForRule(ruleKey, …)` reads `point_rules`, skips disabled rules and
  enforces `weekly_cap`.
- **`getBidderFairness(agentIds)`** (`src/lib/scoreboard-server.ts`) — per
  agent: points this week, owner's points this week, tasks given this week
  (accepted offers), active tasks. Route: `GET /api/scoreboard/bidders`.
- **`getAgentPoints(agentId, range?)`** (`src/lib/points-server.ts`) — for unit
  1's agent card. `getUserPoints(userId, range?)` alongside.
- **Rules block — `getProjectPointsRules()`** (`src/lib/scoreboard-server.ts`)
  — active task types with points/max, `review_points`,
  `idea_accepted`/`task_proposal_accepted` (null when disabled),
  `active_task_limit`. For `/project` and the onboarding prompt.
- **Endpoints:** `GET /api/task-types` (session OR agent key; POST/PATCH admin
  only, 403 server-side, archive-not-delete), `GET /api/scoreboard?range=&week_start=`,
  `GET /api/scoreboard/bidders?agent_ids=`, `GET /api/me/points?page=&limit=`
  (paginated history + balance). All Zod-validated and registered in
  `src/lib/openapi.ts` (`/docs`).

## What's off by default

- `idea_accepted` and `task_proposal_accepted` rules ship **disabled** (5 pts
  each) — a config flip turns them on; nothing pays until the team agrees.
- No proposal points for auto-accepted tasks; review points are a separately
  minted **1 pt** (not deducted from the task).
- `clampTaskPoints(snapshot, maxPoints)` caps approval payouts; a task's payout
  is fixed at its `points_snapshot` when it opens.

## Schema follow-ups for unit 0 (`doc/points-schema-requests.md`)

1. `task_types`, `point_rules` (seeded), `points_ledger` (+ indexes) — SQL in
   `doc/points-schema-TEMP.sql`.
2. `Project` table (single "Zedu" row) for `points_ledger.project_id`.
3. `User.is_platform_admin boolean default false` (touches the NextAuth model).
4. `Task.points_snapshot` / `Task.task_type_id` on the **agent-task** table
   (not the CRM `Task`). Reconcile the `tasks.assigned_agent_id`,
   `offer_accepted_at`, `status` column names used by the scoreboard's
   tasks-given/active queries when unit 3's table lands.
5. Nav: Scoreboard ✅ added (`SidebarNav.tsx`, one marked line). Task types ⏳
   needs an admin-aware nav slot (the static nav isn't role-aware).

## Seed (`prisma/seed.ts`, idempotent, run after unit 0's migration)

6 users (incl. one at 0 points and one over 500), 10 agents, all 7 task types,
3 weeks of ledger entries — including a negative adjustment, a reversal, review
and idea entries, the Sun 23:59 / Mon 00:00 Lagos week-boundary pair, and 3
agent tasks with `points_snapshot` (guarded behind `to_regclass('tasks')`).

## Tests

- `npm test` → **100 pass, 0 fail** (points contract, task types, scoreboard,
  plus the pre-existing suite).
- `npx tsc --noEmit` → clean.
- ESLint: not configured in this repo (`npm run lint` starts interactive setup
  — skipped, per `AGENTS.md`).
- Manual: `/dashboard/task-types` redirects non-admins (server-side
  `is_platform_admin` check + 403 on the API); progress bars verified at
  0/499/500/620 (bar floor/capped at 100, true number shown); range selector
  refetches and the API range math is covered by range-switching tests.
- Until unit 0 applies the migration, the points endpoints return errors and
  the screens show their error states — by design, no demo fallback.

## Open questions

- Review-point funding source (separate mint chosen; ledger can support the
  other model later).
- Final `weekly_target` calibration against the seeded task-type points.
- Who seeds/becomes the first platform admin (seed makes `u_michael` admin for
  testing only).
- Naming clash with the old CRM `Task`/`TaskType` enum remains for unit 0 to
  resolve when the agent-task model lands.
