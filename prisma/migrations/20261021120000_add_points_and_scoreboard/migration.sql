-- Additive: points domain for PR 5 (task types, point rules, points ledger).
-- See doc/points-schema-requests.md. CHECK constraints below are hand-added;
-- Prisma does not model them and will ignore them.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "task_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "max_points" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_rules" (
    "rule_key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekly_cap" INTEGER,

    CONSTRAINT "point_rules_pkey" PRIMARY KEY ("rule_key")
);

-- CreateTable
CREATE TABLE "points_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "project_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "granted_by_user_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_types_slug_key" ON "task_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_idempotency_key_key" ON "points_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "points_ledger_user_id_created_at_idx" ON "points_ledger"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "points_ledger_agent_id_created_at_idx" ON "points_ledger"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "points_ledger_reason_created_at_idx" ON "points_ledger"("reason", "created_at");

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-added CHECK constraints from the PR 5 schema request (DB-level enforcement).
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_points_check" CHECK ("points" >= 0);
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_max_points_check" CHECK ("max_points" >= "points");
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_amount_check" CHECK ("amount" <> 0);
