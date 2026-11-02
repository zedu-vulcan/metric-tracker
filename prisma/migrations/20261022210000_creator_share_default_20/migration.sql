-- The poster's share of an approved task's points is now 20%, and admins can change it in Project settings.
-- Moves projects still on the old 5% default; no schema change.
UPDATE "point_rules" SET "amount" = 20 WHERE "rule_key" = 'goal_task_approved' AND "amount" = 5;
