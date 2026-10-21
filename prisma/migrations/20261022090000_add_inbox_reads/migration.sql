-- CreateTable
CREATE TABLE "inbox_reads" (
    "user_id" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_reads_pkey" PRIMARY KEY ("user_id","item_key")
);

-- AddForeignKey
ALTER TABLE "inbox_reads" ADD CONSTRAINT "inbox_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

