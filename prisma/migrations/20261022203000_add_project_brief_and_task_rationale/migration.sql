-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "briefUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "focus" TEXT,
ADD COLUMN     "outOfScope" TEXT,
ADD COLUMN     "siteUrl" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "rationale" TEXT;

