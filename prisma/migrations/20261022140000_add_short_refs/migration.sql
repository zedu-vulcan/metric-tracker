-- Short references people paste to their agents: G-12 for goals, I-7 for ideas (workstreams), T-341 for tasks.
-- Additive only: new columns with defaults. Existing rows are numbered per project in creation order; nothing is deleted.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "lastGoalNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastIdeaNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastTaskNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Workstream" ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 0;

-- Number the existing rows, oldest first, within each project.
UPDATE "Goal" AS g SET "number" = n.rn
FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt", "id") AS rn FROM "Goal") AS n
WHERE g."id" = n."id";

UPDATE "Workstream" AS w SET "number" = n.rn
FROM (
  SELECT ws."id", ROW_NUMBER() OVER (PARTITION BY goal."projectId" ORDER BY ws."createdAt", ws."id") AS rn
  FROM "Workstream" AS ws JOIN "Goal" AS goal ON goal."id" = ws."goalId"
) AS n
WHERE w."id" = n."id";

UPDATE "Task" AS t SET "number" = n.rn
FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt", "id") AS rn FROM "Task") AS n
WHERE t."id" = n."id";

UPDATE "Project" AS p SET
  "lastGoalNumber" = COALESCE((SELECT MAX("number") FROM "Goal" WHERE "projectId" = p."id"), 0),
  "lastIdeaNumber" = COALESCE((
    SELECT MAX(ws."number") FROM "Workstream" AS ws JOIN "Goal" AS goal ON goal."id" = ws."goalId" WHERE goal."projectId" = p."id"
  ), 0),
  "lastTaskNumber" = COALESCE((SELECT MAX("number") FROM "Task" WHERE "projectId" = p."id"), 0);

-- CreateIndex
CREATE UNIQUE INDEX "Goal_projectId_number_key" ON "Goal"("projectId", "number");

-- CreateIndex
CREATE INDEX "Workstream_number_idx" ON "Workstream"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Task_projectId_number_key" ON "Task"("projectId", "number");

-- Every new row takes the project's next number, whichever code path inserts it. Updating the project row
-- locks it until the transaction ends, so two inserts at once can't get the same number.
CREATE FUNCTION "amp_next_goal_number"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Project" SET "lastGoalNumber" = "lastGoalNumber" + 1
  WHERE "id" = NEW."projectId"
  RETURNING "lastGoalNumber" INTO NEW."number";
  RETURN NEW;
END;
$$;

CREATE FUNCTION "amp_next_idea_number"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Project" SET "lastIdeaNumber" = "lastIdeaNumber" + 1
  WHERE "id" = (SELECT "projectId" FROM "Goal" WHERE "id" = NEW."goalId")
  RETURNING "lastIdeaNumber" INTO NEW."number";
  RETURN NEW;
END;
$$;

CREATE FUNCTION "amp_next_task_number"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Project" SET "lastTaskNumber" = "lastTaskNumber" + 1
  WHERE "id" = NEW."projectId"
  RETURNING "lastTaskNumber" INTO NEW."number";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Goal_number" BEFORE INSERT ON "Goal" FOR EACH ROW EXECUTE FUNCTION "amp_next_goal_number"();
CREATE TRIGGER "Workstream_number" BEFORE INSERT ON "Workstream" FOR EACH ROW EXECUTE FUNCTION "amp_next_idea_number"();
CREATE TRIGGER "Task_number" BEFORE INSERT ON "Task" FOR EACH ROW EXECUTE FUNCTION "amp_next_task_number"();
