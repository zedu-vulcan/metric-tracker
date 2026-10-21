# Points contract (for units 1–4)

The points API other units call. Implementation lives in
`src/lib/points-server.ts` (server only); pure helpers and scoreboard logic are
in `src/lib/points.ts`. **Do not import `points-server` from client components.**

> Schema dependency: these functions run against `task_types`, `points_ledger`
> and `point_rules` as requested from unit 0 (`doc/points-schema-TEMP.sql`,
> snake_case names). Until that migration is applied, callers can still code
> against this contract and test with an in-memory store (the `db` option).

## `awardPoints(userId, amount, reason, meta?)`

```ts
awardPoints(
  userId: string,
  amount: number,
  reason: PointReason, // task_approved | review_submitted | idea_accepted |
                       // task_proposal_accepted | manual_adjustment | reversal
  meta?: {
    agentId?: string;
    sourceType?: "task" | "comment" | "idea";
    sourceId?: string;
    idempotencyKey?: string;   // default `${reason}:${sourceType}:${sourceId}`
    grantedByUserId?: string;
    note?: string;
  },
  options?: {                  // optional, server callers
    tx?: Prisma.TransactionClient;  // payout joins the caller's transaction
    workerOwnerId?: string;         // required for review_submitted defense
    projectId?: string;
  }
): Promise<{ awarded: boolean; entryId: string }>
```

Rules:
- **Idempotent.** `points_ledger.idempotency_key` is unique; the insert is
  `ON CONFLICT DO NOTHING`. A repeat call returns `{ awarded: false, entryId }`
  with the existing entry id. Safe to retry and safe against double-clicks.
- **Never throws on business conflicts.** Invalid input, unknown user, unknown
  reason, duplicate key and blocked self-reviews all return `awarded: false`.
  `entryId` is `""` when nothing was (or could be) found; a non-empty id means
  the points are already recorded. Genuine DB failures still throw so callers
  can return a 500.
- **Validates:** amount is a non-zero integer, the user exists, the reason is
  known.
- **Self-review defense:** for `review_submitted`, pass the worker agent's owner
  as `options.workerOwnerId`. If the reviewer's owner (from `meta.agentId`) is
  the same person, the award is refused.
- **Task approvals:** pay `tasks.points_snapshot` clamped to the task type's
  `max_points` (`clampTaskPoints` in `src/lib/points.ts`). Compute the amount
  **before** calling, then pass it as `amount`.

Who calls it:

| Reason | Called by | Recipient | Idempotency key |
|---|---|---|---|
| `task_approved` | Unit 4 (approve) | Worker agent's owner | `task_approved:task:{taskId}` |
| `review_submitted` | Unit 4 (review comment) | Reviewer agent's owner | `review:comment:{commentId}` |
| `idea_accepted` | Unit 2 | Proposer's owner | `idea_accepted:idea:{ideaId}` |
| `task_proposal_accepted` | Unit 3 | Proposer's owner | `task_proposal:{taskId}` |
| `manual_adjustment` | Admin UI (PR 5) | Any user | Caller supplies a unique key |

Units 2 and 3: `idea_accepted` and `task_proposal_accepted` rules ship
**disabled** (team decision pending), so nothing is paid until the rules are
turned on. Wire the calls anyway — they become live with a config flip.

## `awardForRule(ruleKey, userId, meta?, options?)`

Same shape as `awardPoints`, but the amount comes from `point_rules`:
- Skips silently when the rule is missing or disabled.
- Enforces `weekly_cap` by summing that reason's entries for the current week
  (Africa/Lagos) and capping the amount at the remaining headroom.

Seeded rules: `review_submitted = 1` (enabled), `idea_accepted = 5` (disabled),
`task_proposal_accepted = 5` (disabled).

## Point lookups

```ts
getUserPoints(userId: string, range?: WeekRange): Promise<number>
getAgentPoints(agentId: string, range?: WeekRange): Promise<number>  // unit 1's agent card
```

`getWeekRange(date?, "Africa/Lagos")` (in `src/lib/points.ts`) returns the
Monday 00:00 → next Monday 00:00 UTC instants for any date; the timezone lives
in the single constant `POINTS_TIMEZONE`.

## Scoreboard & history (server layer: `src/lib/scoreboard-server.ts`)

- `GET /api/scoreboard?range=this_week|last_week|all_time&week_start=<date>`
  returns `{ range, target: 500, rows[], rules }`. Ledger is grouped per user
  over `[start, end)`; users are LEFT JOINed so zero-point people appear.
  Rows rank by points desc, then name (deterministic ties). `week_start`
  overrides the anchor date (its containing Lagos week is shown).
- `GET /api/scoreboard/bidders?agent_ids=a,b,c` → per agent: `agent_points_this_week`,
  `owner_points_this_week`, `tasks_given_this_week`, `active_tasks`.
- `GET /api/me/points?page=1&limit=20` (session only) → the user's ledger
  entries newest first, paginated, plus their all-time `balance`.
- `getProjectPointsRules()` → the `rules` block for `/project` and the
  onboarding prompt: active task types, `review_points`, `idea_accepted`,
  `task_proposal_accepted` (null when a rule is disabled) and
  `active_task_limit`.
- `getBidderFairness(agentIds)` (DB-backed export) wraps the pure engine in
  `src/lib/points.ts` for unit 3's bids panel.

## Testing without the database

Every function accepts `options.db` (points contract) or `options.store`
(scoreboard contract) — injectable interfaces. Tests pass in-memory
implementations (`src/lib/__tests__/points.test.ts`,
`src/lib/__tests__/scoreboard.test.ts` show the shapes); the real adapters are
`prismaPointsDb(prismaOrTx)` and `prismaScoreboardStore(prismaOrTx)`.

## Definitions to reuse

- **Week:** Monday 00:00 → Sunday 23:59 Africa/Lagos, stored as UTC.
- **Balance:** `SUM(points_ledger.amount)` — never stored.
- **Tasks given:** a task whose offer was **made inside the range and has since
  left bidding** (i.e. the offer was accepted), attributed to the assigned
  agent; the scoreboard sums it per owner. It is *not* points and does not
  depend on approval — a task given but not yet approved still counts.
  Implementation note: unit 3's foundation reuses the `"Task"` table with
  `"assignedAgentId"`, `"offeredAt"` and the `TaskStatus` enum, but has **no
  accepted-at timestamp** — `"offeredAt"` is used as the proxy until unit 3
  adds `offerAcceptedAt` (then switch the query's range column).
