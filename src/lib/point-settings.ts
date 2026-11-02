import type { Prisma } from "@prisma/client";
import { POINT_SETTING_RULES, pointSettingsFromRules, type PointSettings } from "@/lib/points";
import { prisma } from "@/lib/prisma";

type Client = Prisma.TransactionClient | typeof prisma;

/** A project's point settings: its `point_rules` rows, with defaults for any it doesn't have. */
export async function getPointSettings(projectId: string, client: Client = prisma): Promise<PointSettings> {
  const rules = await client.pointRule.findMany({
    where: { projectId, ruleKey: { in: Object.values(POINT_SETTING_RULES) } },
    select: { ruleKey: true, amount: true, enabled: true },
  });
  return pointSettingsFromRules(rules.map((rule) => ({ ...rule, amount: Number(rule.amount) })));
}

/** Saves the given settings as enabled `point_rules` rows and returns the full set. */
export async function updatePointSettings(projectId: string, changes: Partial<PointSettings>): Promise<PointSettings> {
  const entries = (Object.keys(changes) as (keyof PointSettings)[]).flatMap((key) => {
    const amount = changes[key];
    return amount === undefined ? [] : [{ ruleKey: POINT_SETTING_RULES[key], amount }];
  });
  await prisma.$transaction(
    entries.map(({ ruleKey, amount }) =>
      prisma.pointRule.upsert({
        where: { projectId_ruleKey: { projectId, ruleKey } },
        create: { projectId, ruleKey, amount, enabled: true },
        update: { amount, enabled: true },
      })
    )
  );
  return getPointSettings(projectId);
}
