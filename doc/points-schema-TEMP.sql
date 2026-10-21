-- =============================================================================
-- TEMP MIGRATION — hand to unit 0. DO NOT APPLY.
-- =============================================================================
-- This is a schema *request* written as SQL for clarity. It is intentionally NOT
-- a real Prisma migration (it is not in prisma/migrations/ and must not be run
-- via `prisma migrate deploy`). Unit 0 owns the schema and should turn this into
-- schema.prisma models plus a proper migration.
--
-- Reconciliation notes for unit 0 (deviations between this spec and this repo):
--   1. ID TYPE: the spec says `uuid`, but this repo stores ids as TEXT
--      (Prisma `String @id @default(cuid())`). Use TEXT ids and let Prisma
--      generate cuids, or migrate the whole repo to uuid in a separate decision.
--   2. CASING: column names below are snake_case (from the spec). This repo's
--      Prisma models use camelCase (`maxPoints`, `isActive`, `idempotencyKey`,
--      `createdAt`, …). Map accordingly in schema.prisma.
--   3. `project_id`: there is no `Project` table yet (single "Zedu" project).
--      Add a `Project` table (one seeded row) or leave `project_id` as a plain
--      TEXT column until the project model exists.
--   4. `tasks.points_snapshot` / `tasks.task_type_id`: "tasks" here means the
--      agent-task table that unit 0 owns — NOT the existing CRM `"Task"` table.
--      Do not bolt these onto the CRM checklist task.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- task_types — the points-bearing task categories, managed by platform admins.
-- ---------------------------------------------------------------------------
CREATE TABLE task_types (
    id          uuid PRIMARY KEY,
    slug        text NOT NULL UNIQUE,
    name        text NOT NULL,
    description text,
    points      int  NOT NULL CHECK (points >= 0),
    max_points  int  NOT NULL CHECK (max_points >= points),
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid            -- references the platform admin who last edited
);

-- Seed task types (idempotent). data_entry ships archived as the "archived" example.
INSERT INTO task_types (id, slug, name, description, points, max_points, is_active) VALUES
    (gen_random_uuid(), 'research',     'Research',     'Investigate and report findings', 20, 50, true),
    (gen_random_uuid(), 'lead_hunting', 'Lead hunting', 'Find and qualify contacts',        30, 50, true),
    (gen_random_uuid(), 'content',      'Content',      'Articles, posts, guides',         40, 50, true),
    (gen_random_uuid(), 'seo',          'SEO',          'On-page and technical fixes',      25, 50, true),
    (gen_random_uuid(), 'press',        'Press',        'Pitches and media outreach',       35, 50, true),
    (gen_random_uuid(), 'quick_fix',    'Quick fix',    'Small, well-scoped fixes',          5, 10, true),
    (gen_random_uuid(), 'data_entry',   'Data entry',   'List building and cleanup',         5, 10, false)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- point_rules — small config table for every way to earn points.
-- ---------------------------------------------------------------------------
CREATE TABLE point_rules (
    rule_key   text PRIMARY KEY,
    amount     int  NOT NULL,
    enabled    boolean NOT NULL DEFAULT false,
    weekly_cap int               -- NULL = no weekly cap
);

-- Seed: review_submitted=1 (on), idea_accepted=5 (off),
-- task_proposal_accepted=5 (off), weekly_target=500 (target, not an award).
INSERT INTO point_rules (rule_key, amount, enabled, weekly_cap) VALUES
    ('review_submitted', 1, true,  NULL),
    ('idea_accepted',    5, false, NULL),
    ('task_proposal_accepted', 5, false, NULL),
    ('weekly_target',    500, false, NULL);

-- ---------------------------------------------------------------------------
-- points_ledger — append-only. Balance is SUM(amount); never store a balance.
-- ---------------------------------------------------------------------------
CREATE TABLE points_ledger (
    id                 uuid PRIMARY KEY,
    user_id            uuid NOT NULL,          -- recipient (worker/reviewer owner)
    agent_id           uuid,                   -- agent attribution, nullable
    project_id         uuid NOT NULL,          -- single "Zedu" project (see note 3)
    amount             int  NOT NULL CHECK (amount <> 0),  -- negative for reversals
    reason             text NOT NULL,          -- task_approved | review_submitted |
                                               -- idea_accepted | task_proposal_accepted |
                                               -- manual_adjustment | reversal
    source_type        text,                   -- task | comment | idea
    source_id          uuid,
    idempotency_key    text NOT NULL UNIQUE,   -- guards double-clicks on Approve
    granted_by_user_id uuid,                   -- platform admin / coordinator
    note               text,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX points_ledger_user_created_idx    ON points_ledger (user_id, created_at);
CREATE INDEX points_ledger_agent_created_idx   ON points_ledger (agent_id, created_at);
CREATE INDEX points_ledger_reason_created_idx  ON points_ledger (reason, created_at);

-- ---------------------------------------------------------------------------
-- users.is_platform_admin — server-side gate for task-type editing.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- tasks.points_snapshot / tasks.task_type_id — see note 4.
-- A task's payout is fixed at these when it opens; later edits to a task type
-- must not change in-flight work.
-- ---------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN points_snapshot int;
ALTER TABLE tasks ADD COLUMN task_type_id    uuid REFERENCES task_types(id);
