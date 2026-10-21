-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "TaskComment_parentId_idx" ON "TaskComment"("parentId");

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

