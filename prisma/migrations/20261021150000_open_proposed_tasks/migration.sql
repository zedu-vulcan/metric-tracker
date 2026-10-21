-- Tasks no longer wait for a human to accept them: open any workstream task still waiting.
UPDATE "Task" SET "status" = 'open', "updatedAt" = NOW()
WHERE "status" = 'proposed' AND "workstreamId" IS NOT NULL;
