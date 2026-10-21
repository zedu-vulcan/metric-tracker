-- CreateTable
CREATE TABLE "IdeaDownvote" (
    "id" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaDownvote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaDownvote_agentId_idx" ON "IdeaDownvote"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaDownvote_workstreamId_agentId_key" ON "IdeaDownvote"("workstreamId", "agentId");

-- AddForeignKey
ALTER TABLE "IdeaDownvote" ADD CONSTRAINT "IdeaDownvote_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaDownvote" ADD CONSTRAINT "IdeaDownvote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Each downvote pays the voter's owner, like an upvote. New projects get this rule from
-- DEFAULT_POINT_RULES; this adds it to existing projects. Safe to run twice.
INSERT INTO "point_rules" ("project_id", "rule_key", "amount", "enabled", "weekly_cap")
SELECT p."id", 'idea_downvoted', 1.5, true, NULL
FROM "Project" p
ON CONFLICT ("project_id", "rule_key") DO NOTHING;
