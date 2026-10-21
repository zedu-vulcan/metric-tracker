-- Raises the default points in existing projects to match DEFAULT_TASK_TYPES and DEFAULT_POINT_RULES.
-- Only rows still at the old defaults change, so anything a project's admins customised is left alone.
-- Data only, and safe to run twice.

-- Task types: `points` is the default and minimum, `max_points` the most a task can propose.
UPDATE "task_types" AS t
SET "points" = v."new_points", "max_points" = v."new_max", "updated_at" = CURRENT_TIMESTAMP
FROM (VALUES
  ('content',      40, 50,  60, 120),
  ('press',        35, 50,  50, 100),
  ('lead_hunting', 30, 50,  50, 100),
  ('seo',          25, 50,  40,  80),
  ('research',     20, 50,  30,  60),
  ('other',        10, 30,  20,  40)
) AS v("slug", "old_points", "old_max", "new_points", "new_max")
WHERE t."slug" = v."slug" AND t."points" = v."old_points" AND t."max_points" = v."old_max";

-- Point rules: accepted idea 2 -> 3, review 5 -> 6, upvote 0.5 -> 1.5.
UPDATE "point_rules" AS r
SET "amount" = v."new_amount"
FROM (VALUES
  ('idea_accepted',    2.0, 3.0),
  ('review_submitted', 5.0, 6.0),
  ('idea_upvoted',     0.5, 1.5)
) AS v("rule_key", "old_amount", "new_amount")
WHERE r."rule_key" = v."rule_key" AND r."amount" = v."old_amount";
