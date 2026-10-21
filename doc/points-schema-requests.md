# Points schema requests (for unit 0)

> **Status: APPLIED.** This schema landed as migration
> `20261021120000_add_points_and_scoreboard` (additive; TEXT/cuid ids, snake_case
> column names via `@map`, plus CHECK constraints). The seed is `prisma/seed.ts`
> (`npx prisma db seed`, idempotent). What remains below are the follow-ups.

PR 5 (Points & Scoreboard) needs this schema from unit 0. It is additive only.
The matching SQL draft lives in `doc/points-schema-TEMP.sql` (superseded by the
applied migration). This file lists every column and the nav entries.

> Reconciliation before you implement (the spec vs this repo):
> 1. **IDs** — the spec says `uuid`, but this repo stores ids as `TEXT`
>    (Prisma `String @id @default(cuid())`). Use TEXT/cuid ids.
> 2. **Casing** — Prisma models here are camelCase (`maxPoints`, `isActive`,
>    `idempotencyKey`, `createdAt`). Map the snake_case names below accordingly.
> 3. **`Project`** — no `Project` table exists yet (single "Zedu" project).
>    Add one seeded row, or leave `project_id` as plain TEXT until then.
> 4. **Agent-task table** — `tasks.points_snapshot` / `tasks.task_type_id`
>    belong on the agent-task table, **not** the CRM `"Task"` table.

## Tables

### `task_types`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | text | pk | cuid |
| `slug` | text | unique, not null | machine name |
| `name` | text | not null | display name |
| `description` | text | | |
| `points` | int | not null, `>= 0` | default payout |
| `max_points` | int | not null, `>= points` | cap per task |
| `is_active` | boolean | not null, default true | archive instead of delete |
| `created_at` | timestamptz | not null, default now() | |
| `updated_at` | timestamptz | not null | |
| `updated_by` | text | nullable | platform admin id |

### `points_ledger` (append-only)
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | text | pk | cuid |
| `user_id` | text | not null, fk → User | recipient |
| `agent_id` | text | nullable, fk → Agent | attribution |
| `project_id` | text | not null | single "Zedu" project |
| `amount` | int | not null, `<> 0` | negative = reversal/adjustment |
| `reason` | text | not null | `task_approved` \| `review_submitted` \| `idea_accepted` \| `task_proposal_accepted` \| `manual_adjustment` \| `reversal` |
| `source_type` | text | nullable | `task` \| `comment` \| `idea` |
| `source_id` | text | nullable | |
| `idempotency_key` | text | not null, **unique** | default `${reason}:${sourceType}:${sourceId}` |
| `granted_by_user_id` | text | nullable | admin/coordinator id |
| `note` | text | nullable | |
| `created_at` | timestamptz | not null, default now() | |

Indexes: `(user_id, created_at)`, `(agent_id, created_at)`, `(reason, created_at)`.

### `point_rules`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `rule_key` | text | pk | |
| `amount` | int | not null | |
| `enabled` | boolean | not null, default false | |
| `weekly_cap` | int | nullable | NULL = no cap |

Seed:
| rule_key | amount | enabled | weekly_cap |
|---|---|---|---|
| `review_submitted` | 1 | true | null |
| `idea_accepted` | 5 | false | null |
| `task_proposal_accepted` | 5 | false | null |
| `weekly_target` | 500 | false | null |

### Columns on existing tables
| Column | Table | Type | Notes |
|---|---|---|---|
| `is_platform_admin` | `User` | boolean, default false | server-side gate for task-type editing (touches the NextAuth model — flagged) |
| `points_snapshot` | agent-task | int | fixed at task-open |
| `task_type_id` | agent-task | text, fk → task_types | fixed at task-open |

## Navigation (unit 0 owns the shell/nav)
| Route | Label | Visible to | Status |
|---|---|---|---|
| `/dashboard/scoreboard` | Scoreboard | everyone | ✅ Added by PR 5 in `src/components/SidebarNav.tsx` (one marked line) |
| `/dashboard/task-types` | Task types | platform admins only (under an Admin group — avoid the `ADMIN` label clash) | ⏳ Pending — the static `CHANNELS` nav isn't role-aware; needs an admin-aware nav slot from unit 0 |

## What PR 5 already shipped (no schema needed)
`src/lib/points.ts` (pure domain logic + tests) and demo screens for Scoreboard
and Admin → Task types, plus this doc and the TEMP SQL. Once the schema lands,
the same functions become the endpoints (`/task-types`, `/scoreboard`,
`/scoreboard/bidders`).
