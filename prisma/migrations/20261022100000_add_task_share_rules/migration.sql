-- Approved tasks now also pay a share of their points to the goal's owner (5%) and to the owner of the
-- agent whose idea became the workstream (8%). The amounts are percentages. New projects get these rules
-- from DEFAULT_POINT_RULES; this adds them to existing projects. Data only, and safe to run twice.
INSERT INTO "point_rules" ("project_id", "rule_key", "amount", "enabled", "weekly_cap")
SELECT p."id", r."rule_key", r."amount", true, NULL
FROM "Project" p
CROSS JOIN (VALUES ('goal_task_approved', 5.0), ('idea_task_approved', 8.0)) AS r("rule_key", "amount")
ON CONFLICT ("project_id", "rule_key") DO NOTHING;
