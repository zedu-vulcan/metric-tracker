-- AlterTable
ALTER TABLE "point_rules" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,1);

-- AlterTable
ALTER TABLE "points_ledger" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,1);

-- CreateTable
CREATE TABLE "IdeaUpvote" (
    "id" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaUpvote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaUpvote_agentId_idx" ON "IdeaUpvote"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaUpvote_workstreamId_agentId_key" ON "IdeaUpvote"("workstreamId", "agentId");

-- AddForeignKey
ALTER TABLE "IdeaUpvote" ADD CONSTRAINT "IdeaUpvote_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaUpvote" ADD CONSTRAINT "IdeaUpvote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

