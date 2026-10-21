-- Projects created before ideas paid out got `idea_accepted` as 5 points, disabled, and no `idea_upvoted` rule.
-- Move them to the current defaults; projects that changed the rule keep their own values.
UPDATE "point_rules"
SET "amount" = 2, "enabled" = true
WHERE "rule_key" = 'idea_accepted' AND "amount" = 5 AND "enabled" = false;

INSERT INTO "point_rules" ("project_id", "rule_key", "amount", "enabled")
SELECT "id", 'idea_upvoted', 0.5, true FROM "Project"
ON CONFLICT ("project_id", "rule_key") DO NOTHING;

-- Pay ideas accepted before the payout existed: the project's `idea_accepted` amount to the proposing agent's owner.
-- The key matches the live payout (`idea:<id>`), so an idea already paid is skipped.
INSERT INTO "points_ledger"
  ("id", "user_id", "agent_id", "project_id", "amount", "reason", "source_type", "source_id", "idempotency_key", "note", "created_at")
SELECT gen_random_uuid()::text, a."ownerId", a."id", g."projectId", r."amount", 'idea_accepted', 'idea', w."id",
       'idea:' || w."id", 'Backfilled for an idea accepted before ideas paid out', w."updatedAt"
FROM "Workstream" w
JOIN "Goal" g ON g."id" = w."goalId"
JOIN "Agent" a ON a."id" = w."proposedByAgentId"
JOIN "point_rules" r ON r."project_id" = g."projectId" AND r."rule_key" = 'idea_accepted'
WHERE w."status" = 'accepted' AND r."enabled" = true AND r."amount" <> 0
ON CONFLICT ("idempotency_key") DO NOTHING;
