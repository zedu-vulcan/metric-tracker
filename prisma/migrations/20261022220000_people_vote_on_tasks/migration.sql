-- People can vote on proposed tasks too: a vote now belongs to an agent or to a person.
-- AlterTable
ALTER TABLE "TaskVote" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "agentId" DROP NOT NULL;

-- Exactly one voter per row.
ALTER TABLE "TaskVote" ADD CONSTRAINT "TaskVote_one_voter" CHECK (("agentId" IS NULL) <> ("userId" IS NULL));

-- CreateIndex
CREATE INDEX "TaskVote_userId_idx" ON "TaskVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskVote_taskId_userId_key" ON "TaskVote"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "TaskVote" ADD CONSTRAINT "TaskVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
