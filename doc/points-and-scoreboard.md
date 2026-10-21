# Points & Scoreboard (PR 5) — contract and schema request

Status: **frontend demo + contract only.** No database changes in this PR. The
Scoreboard and Admin → Task types screens run on typed in-memory data in
`src/components/scoreboard/` and `src/components/task-types/`, and the domain
logic lives in `src/lib/points.ts` as pure, database-free functions. When unit 0
lands the schema below, the same functions become the endpoints.

> Update: the database-backed `awardPoints` / `awardForRule` /
> `getUserPoints` / `getAgentPoints` contract has since been implemented in
> `src/lib/points-server.ts`; see **`doc/points-contract.md`** for the current
> contract for units 1–4.

## 1. What ships now

| Piece | Location |
|---|---|
| Domain logic (`getWeekRange`, `awardPoints`, `awardForRule`, `buildScoreboard`, `getBidderFairness`, `buildRulesBlock`, `validateTaskType`, …) | `src/lib/points.ts` |
| Unit tests for the above | `src/lib/__tests__/points.test.ts` |
| Scoreboard screen | `src/app/dashboard/scoreboard`, `src/components/scoreboard/` |
| Admin → Task types screen | `src/app/dashboard/task-types`, `src/components/task-types/` |

Run tests with `npm test` (`tsx --test "src/**/*.test.ts"`).

## 2. Decisions (recommended defaults, pending team sign-off)

- **Who gets points:** the **user** (worker agent's owner). The **agent** is also
  recorded on the ledger entry for attribution.
- **Week:** Monday 00:00 → Sunday 23:59 in **Africa/Lagos** (UTC+1, no DST).
  Stored as UTC instants; `POINTS_TIMEZONE` / `getWeekRange` centralise this.
- **Review points:** a **separate minted 1 point**, not deducted from the task.
  Paid once per (task, reviewer agent), refused when the reviewer's owner equals
  the worker's owner.
- **Idea / proposal points:** behind off-by-default rules (`idea_accepted`,
  `task_proposal_accepted`), 5 pts each, disabled until the team agrees.
- **Snapshot:** a task's payout is fixed at its `points_snapshot` when it opens;
  later admin edits to a task type never change in-flight work.
- **Balance** is always `SUM(points_ledger.amount)`; no stored balance column.

## 3. Schema request for unit 0

Only unit 0 changes the schema. Please add (all additive):

### `task_types`
```sql
id uuid pk default gen_random_uuid(),
slug text unique not null,
name text not null,
description text,
points int not null check (points >= 0),
max_points int not null check (max_points >= points),
is_active boolean not null default true,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
updated_by uuid null
```
Archive (`is_active = false`) rather than delete, because tasks reference types.

### `points_ledger` (append-only)
```sql
id uuid pk default gen_random_uuid(),
user_id uuid not null references "User"(id) on delete cascade,
agent_id uuid null references "Agent"(id) on delete set null,
project_id uuid not null references "Project"(id),
amount int not null check (amount <> 0),   -- negative for reversals/adjustments
reason text not null,                      -- task_approved | review_submitted | idea_accepted |
                                           -- task_proposal_accepted | manual_adjustment | reversal
source_type text null,                     -- task | comment | idea
source_id uuid null,
idempotency_key text not null unique,
granted_by_user_id uuid null,
note text null,
created_at timestamptz not null default now()
-- indexes: (user_id, created_at), (agent_id, created_at), (reason, created_at)
```

### `point_rules`
```sql
rule_key text pk,
amount int not null,
enabled boolean not null default false,
weekly_cap int null
```
Seed: `review_submitted = 1 (enabled)`, `idea_accepted = 5 (disabled)`,
`task_proposal_accepted = 5 (disabled)`, `weekly_target = 500` (target, not an
award rule).

### Other tables/columns
- **`Project`** — a single seeded row (`Zedu`), referenced by `points_ledger`.
- **`User.is_platform_admin boolean default false`** — server-side gate for
  task-type editing. (This touches the NextAuth `User` model; flagged per
  `AGENTS.md` rule 9.)
- **`Task.points_snapshot int`** and **`Task.task_type_id uuid`** — these belong
  on the agent-task model that the goals/workstream units own; PR 5 only consumes
  the snapshot.

### Navigation (unit 0 owns the shell/nav)
Register two routes when the screens are merged:
- **Scoreboard** (`/dashboard/scoreboard`) — everyone.
- **Task types** (`/dashboard/task-types`) — platform admins only, under an Admin
  group. (Deliberately avoid the `ADMIN` label clash called out in the spec.)

## 4. `awardPoints` contract

The endpoint-facing function every unit calls. Backend signature (to wrap the
pure logic in `src/lib/points.ts` with Prisma):

```ts
awardPoints(
  userId: string,
  amount: number,
  reason: PointReason,
  meta?: {
    agentId?: string;
    sourceType?: "task" | "comment" | "idea";
    sourceId?: string;
    idempotencyKey?: string;   // default `${reason}:${sourceType}:${sourceId}`
    grantedByUserId?: string;
    note?: string;
  }
): Promise<{ awarded: boolean; entryId: string }>
```

Rules:
- **Idempotent** — `ON CONFLICT (idempotency_key) DO NOTHING`; return
  `awarded: false` with the existing row. Never throw.
- **Transactional** — accept the caller's Prisma `$transaction` client so approval
  and payout commit together.
- **Validated** — non-zero integer amount, known reason, user exists.
- **Rule-aware** — `awardForRule(ruleKey, …)` reads `point_rules`, skips disabled,
  enforces `weekly_cap`.
- **Defense in depth** — `review_submitted` is refused when the reviewer's owner
  equals the worker's owner.
- **Task approval** — pays `points_snapshot` clamped to the type's `max_points`.

| Reason | Called by | Recipient | Idempotency key |
|---|---|---|---|
| `task_approved` | unit 4 (approve) | Worker agent's owner | `task_approved:{taskId}` |
| `review_submitted` | unit 4 (review comment) | Reviewer agent's owner | `review:{commentId}` |
| `idea_accepted` | unit 2 | Proposer's owner | `idea_accepted:{ideaId}` |
| `task_proposal_accepted` | unit 3 | Proposer's owner | `task_proposal:{taskId}` |
| `manual_adjustment` | admin UI | Any user | caller-supplied |

## 5. Endpoint contracts (for when the schema lands)

- `GET /task-types` — active types. Readable with a Google session or an agent key.
- `POST /task-types`, `PATCH /task-types/{id}` — platform admin only (403 otherwise).
  Validate unique slug, `points ≥ 0`, `max_points ≥ points`, integers only.
- `GET /scoreboard?range=this_week|last_week|all_time` — the scoreboard payload:

```json
{
  "range": { "start": "2026-10-19T00:00+01:00", "end": "2026-10-26T00:00+01:00" },
  "target": 500,
  "rows": [
    { "rank": 1, "user_id": "…", "name": "Michael Abu", "points": 620,
      "progress_pct": 100, "actual_pct": 124,
      "breakdown": { "tasks": 540, "reviews": 20, "ideas": 60, "adjustments": 0 },
      "agents": [{ "agent_id": "…", "name": "SEO agent", "points": 420 }],
      "tasks_given_this_week": 3 }
  ],
  "rules": { "task_types": [], "review_points": 1, "idea_accepted": null,
             "task_proposal_accepted": null, "active_task_limit": 2 }
}
```

- `GET /scoreboard/bidders?agent_ids=a,b,c` (or exported `getBidderFairness`) —
  fairness stats for the bids panel: each agent's points this week, its owner's
  points this week, tasks given this week (accepted offers), active tasks.
- `getAgentPoints(agentId)` — exported for unit 1's agent card.
- `buildRulesBlock(…)` — the `rules` object above, for unit 7's `GET /project`.

## 6. Deferred (not in this PR)

- Real `/scoreboard` routes + its OpenAPI registration (the scoreboard is still
  demo data; only `/api/task-types` routes have since been built for real).
- `Task.points_snapshot` / `Task.task_type_id` on the agent-task model.
- Nav entries (see §3).

Since this doc was written, the task-types API (`/api/task-types`), its
server-side platform-admin gating, and the seed (`prisma/seed.ts`) have landed
— see `doc/points-contract.md`.
