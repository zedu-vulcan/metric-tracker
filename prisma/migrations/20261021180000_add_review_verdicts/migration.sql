-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('approve', 'changes');

-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "verdict" "ReviewVerdict";

