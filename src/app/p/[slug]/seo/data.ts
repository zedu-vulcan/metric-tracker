import { prisma } from "@/lib/prisma";
import type { CategoryScores, CheckResult, Snapshot } from "@/lib/seo/types";

export const DEFAULT_SEO_PAGE_URL = "https://zedu.chat";

export interface SeoView {
  check: {
    id: string;
    url: string;
    normalizedUrl: string;
    score: number;
    categoryScores: CategoryScores;
    snapshot: Snapshot;
    results: CheckResult[];
    errorCount: number;
    createdAt: string;
  };
  previous: { score: number; createdAt: string } | null;
  history: { id: string; score: number; createdAt: string }[];
}

type Row = NonNullable<Awaited<ReturnType<typeof prisma.seoCheck.findFirst>>>;

/** Everything the page shows for one saved check: the check, the one before it, and the history. */
export async function buildView(row: Row): Promise<SeoView> {
  const [history, earlier] = await Promise.all([
    prisma.seoCheck.findMany({
      where: { projectId: row.projectId, normalizedUrl: row.normalizedUrl },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, score: true, createdAt: true },
    }),
    prisma.seoCheck.findFirst({
      where: { projectId: row.projectId, normalizedUrl: row.normalizedUrl, createdAt: { lt: row.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { score: true, createdAt: true },
    }),
  ]);
  return {
    check: {
      id: row.id,
      url: row.url,
      normalizedUrl: row.normalizedUrl,
      score: row.score,
      categoryScores: row.categoryScores as unknown as CategoryScores,
      snapshot: row.snapshot as unknown as Snapshot,
      results: row.results as unknown as CheckResult[],
      errorCount: row.errorCount,
      createdAt: row.createdAt.toISOString(),
    },
    previous: earlier ? { score: earlier.score, createdAt: earlier.createdAt.toISOString() } : null,
    history: history.map((h) => ({ id: h.id, score: h.score, createdAt: h.createdAt.toISOString() })),
  };
}

export async function getLatestView(projectId: string): Promise<SeoView | null> {
  const row = await prisma.seoCheck.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } });
  return row ? buildView(row) : null;
}

export async function getSeoPageUrl(projectId: string): Promise<string> {
  const settings = await prisma.seoSettings.findUnique({ where: { projectId } });
  return settings?.pageUrl ?? DEFAULT_SEO_PAGE_URL;
}

export async function getViewById(projectId: string, id: string): Promise<SeoView | null> {
  const row = await prisma.seoCheck.findFirst({ where: { id, projectId } });
  return row ? buildView(row) : null;
}
