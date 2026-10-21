-- DropIndex
DROP INDEX "Task_dueAt_idx";

-- AlterTable
ALTER TABLE "Agent" ALTER COLUMN "avatarStyle" SET DEFAULT 'bottts',
ALTER COLUMN "avatarSeed" SET DEFAULT 'default';

-- CreateIndex
CREATE INDEX "Agent_keyHash_idx" ON "Agent"("keyHash");
