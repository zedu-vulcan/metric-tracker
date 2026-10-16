-- Create List table
CREATE TABLE "List" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- Create a default list to migrate existing directories into
INSERT INTO "List" ("id", "name", "updatedAt")
VALUES ('cldefault000000000000000000', 'Directories', CURRENT_TIMESTAMP);

-- Add listId to Directory (nullable first for data migration)
ALTER TABLE "Directory" ADD COLUMN "listId" TEXT;

-- Make url nullable
ALTER TABLE "Directory" ALTER COLUMN "url" DROP NOT NULL;

-- Assign all existing directories to the default list
UPDATE "Directory" SET "listId" = 'cldefault000000000000000000';

-- Now enforce NOT NULL on listId
ALTER TABLE "Directory" ALTER COLUMN "listId" SET NOT NULL;

-- Add FK from Directory to List
ALTER TABLE "Directory" ADD CONSTRAINT "Directory_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove duplicate submissions per directoryId (keep most recent per directory)
WITH ranked AS (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "directoryId" ORDER BY "createdAt" DESC) AS rn
    FROM "Submission"
)
DELETE FROM "Submission" WHERE "id" IN (
    SELECT "id" FROM ranked WHERE rn > 1
);

-- Drop old composite unique constraint
ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_productId_directoryId_key";

-- Add new unique constraint on directoryId alone
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_directoryId_key" UNIQUE ("directoryId");

-- Drop FK from Submission to Product
ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_productId_fkey";

-- Drop productId column
ALTER TABLE "Submission" DROP COLUMN IF EXISTS "productId";

-- Drop Product table
DROP TABLE IF EXISTS "Product";
