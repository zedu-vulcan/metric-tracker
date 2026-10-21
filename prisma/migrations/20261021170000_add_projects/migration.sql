-- Multi-tenant projects. Every team's data now belongs to a project, and people create
-- their projects from the app. Decision 21 Oct 2026: existing data is NOT migrated into a
-- project; it is deleted so every project starts clean. Users, their Google accounts and
-- sessions are kept.

DELETE FROM "TaskComment";
DELETE FROM "Task";
DELETE FROM "Workstream";
DELETE FROM "Goal";
DELETE FROM "points_ledger";
DELETE FROM "Agent";
DELETE FROM "task_types";
DELETE FROM "point_rules";
DELETE FROM "DirectoryChecklistItem";
DELETE FROM "DirectoryActivity";
DELETE FROM "Directory";
DELETE FROM "SavedCopy";
DELETE FROM "PressSubmission";
DELETE FROM "PressCoverage";
DELETE FROM "PressOutlet";
DELETE FROM "SeoCheck";
DELETE FROM "SeoSettings";
DELETE FROM "ContentItem";

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('owner', 'admin', 'member');

-- DropIndex
DROP INDEX "PressOutlet_key_key";

-- DropIndex
DROP INDEX "task_types_slug_key";

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PressCoverage" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PressSubmission" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SeoCheck" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SeoSettings" ADD COLUMN     "projectId" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Directory" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DirectoryActivity" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SavedCopy" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PressOutlet" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "projectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "task_types" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "point_rules" DROP CONSTRAINT "point_rules_pkey",
ADD COLUMN     "project_id" TEXT NOT NULL,
ADD CONSTRAINT "point_rules_pkey" PRIMARY KEY ("project_id", "rule_key");

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_joinCode_key" ON "Project"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Project_inviteToken_key" ON "Project"("inviteToken");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ContentItem_projectId_idx" ON "ContentItem"("projectId");

-- CreateIndex
CREATE INDEX "PressCoverage_projectId_idx" ON "PressCoverage"("projectId");

-- CreateIndex
CREATE INDEX "PressSubmission_projectId_idx" ON "PressSubmission"("projectId");

-- CreateIndex
CREATE INDEX "SeoCheck_projectId_idx" ON "SeoCheck"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSettings_projectId_key" ON "SeoSettings"("projectId");

-- CreateIndex
CREATE INDEX "Directory_projectId_idx" ON "Directory"("projectId");

-- CreateIndex
CREATE INDEX "DirectoryActivity_projectId_idx" ON "DirectoryActivity"("projectId");

-- CreateIndex
CREATE INDEX "SavedCopy_projectId_idx" ON "SavedCopy"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PressOutlet_projectId_key_key" ON "PressOutlet"("projectId", "key");

-- CreateIndex
CREATE INDEX "Agent_projectId_idx" ON "Agent"("projectId");

-- CreateIndex
CREATE INDEX "Goal_projectId_idx" ON "Goal"("projectId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_project_id_slug_key" ON "task_types"("project_id", "slug");

-- CreateIndex
CREATE INDEX "points_ledger_project_id_created_at_idx" ON "points_ledger"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressCoverage" ADD CONSTRAINT "PressCoverage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressSubmission" ADD CONSTRAINT "PressSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoCheck" ADD CONSTRAINT "SeoCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSettings" ADD CONSTRAINT "SeoSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Directory" ADD CONSTRAINT "Directory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryActivity" ADD CONSTRAINT "DirectoryActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCopy" ADD CONSTRAINT "SavedCopy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressOutlet" ADD CONSTRAINT "PressOutlet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_rules" ADD CONSTRAINT "point_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

