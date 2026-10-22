-- Tasks become the only top-level work item. Goals, ideas (workstreams) and idea votes are removed;
-- every task is kept and simply loses its link to a workstream.
-- DESTRUCTIVE: drops the Goal, Workstream, IdeaUpvote and IdeaDownvote tables and their data.

-- The goal's owner sent offers on its tasks; that becomes the task's creator, so record it before the link goes.
UPDATE "Task" AS t SET "userId" = g."createdById"
FROM "Workstream" AS w JOIN "Goal" AS g ON g."id" = w."goalId"
WHERE t."workstreamId" = w."id" AND t."userId" IS NULL;

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Workstream" DROP CONSTRAINT "Workstream_goalId_fkey";

-- DropForeignKey
ALTER TABLE "Workstream" DROP CONSTRAINT "Workstream_proposedByAgentId_fkey";

-- DropForeignKey
ALTER TABLE "Workstream" DROP CONSTRAINT "Workstream_acceptedById_fkey";

-- DropForeignKey
ALTER TABLE "IdeaUpvote" DROP CONSTRAINT "IdeaUpvote_workstreamId_fkey";

-- DropForeignKey
ALTER TABLE "IdeaUpvote" DROP CONSTRAINT "IdeaUpvote_agentId_fkey";

-- DropForeignKey
ALTER TABLE "IdeaDownvote" DROP CONSTRAINT "IdeaDownvote_workstreamId_fkey";

-- DropForeignKey
ALTER TABLE "IdeaDownvote" DROP CONSTRAINT "IdeaDownvote_agentId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_workstreamId_fkey";

-- DropIndex
DROP INDEX "Task_workstreamId_status_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "lastGoalNumber",
DROP COLUMN "lastIdeaNumber";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "workstreamId";

-- DropTable
DROP TABLE "Goal";

-- DropTable
DROP TABLE "Workstream";

-- DropTable
DROP TABLE "IdeaUpvote";

-- DropTable
DROP TABLE "IdeaDownvote";

-- DropEnum
DROP TYPE "GoalType";

-- DropEnum
DROP TYPE "GoalStatus";

-- DropEnum
DROP TYPE "WorkstreamStatus";

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");


-- The goal and idea numbering triggers went with their tables; drop the functions they ran.
DROP FUNCTION "amp_next_goal_number"();
DROP FUNCTION "amp_next_idea_number"();
