-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('seo', 'content', 'marketing', 'research', 'outreach');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "WorkstreamStatus" AS ENUM ('proposed', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('proposed', 'open', 'bidding', 'in_progress', 'submitted', 'in_review', 'changes_requested', 'approved', 'reopened');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('idea', 'bid', 'review', 'delivery', 'revision_request', 'approval', 'escalation', 'note');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "workstreamId" TEXT,
ADD COLUMN "taskType" TEXT,
ADD COLUMN "status" "TaskStatus" NOT NULL DEFAULT 'proposed',
ADD COLUMN "assignedAgentId" TEXT,
ADD COLUMN "offeredToAgentId" TEXT,
ADD COLUMN "offeredAt" TIMESTAMP(3),
ADD COLUMN "offerExpiresAt" TIMESTAMP(3),
ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxRevisions" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "dueAt" DROP NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "lastActiveAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "GoalType" NOT NULL DEFAULT 'marketing',
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workstream" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkstreamStatus" NOT NULL DEFAULT 'proposed',
    "autoAcceptTasks" BOOLEAN NOT NULL DEFAULT false,
    "proposedByAgentId" TEXT,
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "CommentType" NOT NULL DEFAULT 'note',
    "tag" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "attachment" TEXT,
    "score" INTEGER,
    "authorAgentId" TEXT,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_apiKey_key" ON "Agent"("apiKey");

-- CreateIndex
CREATE INDEX "Agent_userId_idx" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "Agent_apiKey_idx" ON "Agent"("apiKey");

-- CreateIndex
CREATE INDEX "Goal_type_idx" ON "Goal"("type");

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- CreateIndex
CREATE INDEX "Goal_createdById_idx" ON "Goal"("createdById");

-- CreateIndex
CREATE INDEX "Workstream_goalId_status_idx" ON "Workstream"("goalId", "status");

-- CreateIndex
CREATE INDEX "Workstream_proposedByAgentId_idx" ON "Workstream"("proposedByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Workstream_goalId_title_key" ON "Workstream"("goalId", "title");

-- CreateIndex
CREATE INDEX "Task_workstreamId_status_idx" ON "Task"("workstreamId", "status");

-- CreateIndex
CREATE INDEX "Task_assignedAgentId_idx" ON "Task"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Task_offeredToAgentId_idx" ON "Task"("offeredToAgentId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_type_idx" ON "TaskComment"("taskId", "type");

-- CreateIndex
CREATE INDEX "TaskComment_authorAgentId_idx" ON "TaskComment"("authorAgentId");

-- CreateIndex
CREATE INDEX "TaskComment_authorUserId_idx" ON "TaskComment"("authorUserId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_proposedByAgentId_fkey" FOREIGN KEY ("proposedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_offeredToAgentId_fkey" FOREIGN KEY ("offeredToAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
