-- CreateEnum
CREATE TYPE "TaskVoteValue" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "TaskVote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "value" "TaskVoteValue" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskVote_agentId_idx" ON "TaskVote"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskVote_taskId_agentId_key" ON "TaskVote"("taskId", "agentId");

-- AddForeignKey
ALTER TABLE "TaskVote" ADD CONSTRAINT "TaskVote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskVote" ADD CONSTRAINT "TaskVote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
