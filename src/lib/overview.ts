import { countPerWeek, lastWeeks } from "@/components/charts/WeeklyCharts";
import { outletKey } from "@/lib/outlet-key";
import { prisma } from "@/lib/prisma";
import { todoList } from "@/lib/seo/scoring";
import type { CheckResult } from "@/lib/seo/types";

const DAY = 86_400_000;
export const OVERVIEW_WEEKS = 8;
const CLOSED_SUBMISSION = ["Published", "Rejected", "Withdrawn"] as const;
/** A directory still pending review after this many days needs a nudge. */
const DIRECTORY_REVIEW_DAYS = 14;

export const shortDate = (value: Date) =>
  value.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export type AttentionItem = {
  id: string;
  channel: "Press" | "SEO" | "Content" | "Directories";
  tone: "warning" | "destructive";
  title: string;
  detail: string;
  href: string;
  rank: number;
};

export type UpcomingItem = {
  id: string;
  date: Date;
  title: string;
  meta: string;
};

/**
 * Everything one project's overview page shows, computed in one place so the AI summary sees the same numbers.
 * `basePath` is the project's dashboard path (`/p/<slug>`), for the "needs attention" links.
 */
export async function getOverview(projectId: string, basePath: string) {
  const [content, latestCheck, coverage, featuredPitches, openSubmissions, pitchStatuses, directories] = await Promise.all([
    prisma.contentItem.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        type: true,
        platform: true,
        status: true,
        createdDate: true,
        publishDate: true,
        updatedAt: true,
      },
      orderBy: [{ createdDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.seoCheck.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { score: true, url: true, normalizedUrl: true, createdAt: true, results: true },
    }),
    prisma.pressCoverage.findMany({ where: { projectId }, select: { outlet: true, publicationDate: true } }),
    // Older pitches marked Published without their own coverage record still count as features.
    prisma.pressSubmission.findMany({
      where: { projectId, status: "Published", coverageId: null },
      select: { outlet: true },
    }),
    prisma.pressSubmission.findMany({
      where: { projectId, status: { notIn: [...CLOSED_SUBMISSION] } },
      select: { id: true, title: true, outlet: true, status: true, followUpDate: true },
    }),
    prisma.pressSubmission.groupBy({ by: ["status"], where: { projectId, coverageId: null }, _count: { _all: true } }),
    prisma.directory.findMany({ where: { projectId }, select: { id: true, name: true, status: true, dateSubmitted: true } }),
  ]);

  const previousCheck = latestCheck
    ? await prisma.seoCheck.findFirst({
        where: { projectId, normalizedUrl: latestCheck.normalizedUrl, createdAt: { lt: latestCheck.createdAt } },
        orderBy: { createdAt: "desc" },
        select: { score: true },
      })
    : null;

  const today = startOfUtcDay(new Date());
  const monthAgo = new Date(today.getTime() - 30 * DAY);
  const published = content.filter((item) => item.status === "Published");
  const publishedThisMonth = published.filter((item) => item.publishDate && item.publishDate >= monthAgo).length;
  const inPipeline = content.filter((item) => item.status === "Draft" || item.status === "Scheduled").length;
  const scheduledAhead = content.filter(
    (item) => item.status === "Scheduled" && item.publishDate && item.publishDate >= today
  ).length;
  const outletsFeatured = new Set(
    [...coverage, ...featuredPitches].map((item) => outletKey(item.outlet)).filter(Boolean)
  ).size;
  const piecesOfCoverage = coverage.length + featuredPitches.length;
  const scoreChange = latestCheck && previousCheck ? latestCheck.score - previousCheck.score : null;

  const pitchCount = (...statuses: string[]) =>
    pitchStatuses.filter((group) => statuses.includes(group.status)).reduce((sum, group) => sum + group._count._all, 0);
  const funnel = {
    targets: pitchCount("Draft"),
    pitched: pitchCount("Submitted", "UnderReview", "ChangesRequested", "Accepted"),
    featured: piecesOfCoverage,
    closed: pitchCount("Rejected", "Withdrawn"),
  };
  // Targets haven't been pitched, so only pitches can have a follow-up due (matches the Press page).
  const pitches = openSubmissions.filter((item) => item.status !== "Draft");
  const followUpsDue = pitches.filter((item) => item.followUpDate && item.followUpDate <= today).length;

  const directoryCounts = {
    total: directories.length,
    live: directories.filter((item) => item.status === "Live").length,
    pending: directories.filter((item) => item.status === "PendingReview").length,
    needChanges: directories.filter((item) => item.status === "NeedsChanges").length,
  };

  const weeks = lastWeeks(OVERVIEW_WEEKS, today);
  const createdInRange = countPerWeek(weeks, content.map((item) => item.createdDate)).reduce((sum, n) => sum + n, 0);
  const publishedPerWeek = countPerWeek(
    weeks,
    published.flatMap((item) => (item.publishDate ? [item.publishDate] : []))
  );
  const coveragePerWeek = countPerWeek(
    weeks,
    coverage.flatMap((item) => (item.publicationDate ? [item.publicationDate] : []))
  );

  const upcoming: UpcomingItem[] = [
    ...content
      .filter((item) => item.publishDate && item.publishDate >= today && item.status !== "Published")
      .map((item) => ({
        id: `content-${item.id}`,
        date: item.publishDate as Date,
        title: item.title || "Untitled",
        meta: `Publish · ${item.platform || item.type || "content"}`,
      })),
    // Overdue follow-ups are listed under "Needs attention", so only upcoming ones show here.
    ...pitches
      .filter((item) => item.followUpDate && item.followUpDate >= today)
      .map((item) => ({
        id: `press-${item.id}`,
        date: item.followUpDate as Date,
        title: item.title || "Pitch",
        meta: `Follow up · ${item.outlet}`,
      })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  const seo = latestCheck
    ? { score: latestCheck.score, change: scoreChange, host: hostOf(latestCheck.url), checkedAt: latestCheck.createdAt }
    : null;

  const daysSince = (date: Date) => Math.floor((today.getTime() - startOfUtcDay(date).getTime()) / DAY);
  const attention: AttentionItem[] = [];
  for (const pitch of pitches) {
    if (pitch.followUpDate && pitch.followUpDate <= today) {
      const late = daysSince(pitch.followUpDate);
      attention.push({
        id: `follow-up-${pitch.id}`,
        channel: "Press",
        tone: "warning",
        title: `Follow up with ${pitch.outlet}`,
        detail: `${pitch.title || "Pitch"} · ${late === 0 ? "due today" : `${late} ${late === 1 ? "day" : "days"} overdue`}`,
        href: `${basePath}/media`,
        rank: 0,
      });
    }
    if (pitch.status === "ChangesRequested") {
      attention.push({
        id: `changes-${pitch.id}`,
        channel: "Press",
        tone: "warning",
        title: `${pitch.outlet} asked for changes`,
        detail: pitch.title || "Pitch",
        href: `${basePath}/media`,
        rank: 1,
      });
    }
  }
  if (latestCheck && seo) {
    const errors = todoList(latestCheck.results as unknown as CheckResult[]).filter(
      (result) => result.severity === "error" && result.outcome === "fail"
    );
    errors.slice(0, 2).forEach((result, index) =>
      attention.push({
        id: `seo-${result.id}`,
        channel: "SEO",
        tone: "destructive",
        title: result.label,
        detail: `${seo.host} · SEO error ${index + 1} of ${errors.length}`,
        href: `${basePath}/seo`,
        rank: 0,
      })
    );
    const age = daysSince(latestCheck.createdAt);
    if (age >= 7) {
      attention.push({
        id: "seo-stale",
        channel: "SEO",
        tone: "warning",
        title: `SEO check is ${age} days old`,
        detail: `Run a fresh check of ${seo.host}`,
        href: `${basePath}/seo`,
        rank: 2,
      });
    }
  }
  for (const item of content) {
    if (item.status === "Scheduled" && item.publishDate && item.publishDate < today) {
      attention.push({
        id: `missed-${item.id}`,
        channel: "Content",
        tone: "destructive",
        title: `Missed publish date: ${item.title || "Untitled"}`,
        detail: `Was scheduled for ${shortDate(item.publishDate)}`,
        href: `${basePath}/content`,
        rank: 0,
      });
    }
    const idle = daysSince(item.updatedAt);
    if (item.status === "Draft" && idle >= 30) {
      attention.push({
        id: `stale-${item.id}`,
        channel: "Content",
        tone: "warning",
        title: `Draft untouched for ${idle} days`,
        detail: item.title || "Untitled",
        href: `${basePath}/content`,
        rank: 2,
      });
    }
  }
  for (const directory of directories) {
    if (directory.status === "NeedsChanges") {
      attention.push({
        id: `directory-changes-${directory.id}`,
        channel: "Directories",
        tone: "warning",
        title: `${directory.name} asked for changes`,
        detail: "Update the listing and resubmit",
        href: `${basePath}/directories`,
        rank: 1,
      });
    }
    const waiting = directory.dateSubmitted ? daysSince(directory.dateSubmitted) : 0;
    if (directory.status === "PendingReview" && waiting >= DIRECTORY_REVIEW_DAYS) {
      attention.push({
        id: `directory-pending-${directory.id}`,
        channel: "Directories",
        tone: "warning",
        title: `${directory.name} still pending review`,
        detail: `Submitted ${waiting} days ago`,
        href: `${basePath}/directories`,
        rank: 2,
      });
    }
  }
  attention.sort((a, b) => a.rank - b.rank);

  return {
    today,
    content: {
      published: published.length,
      publishedThisMonth,
      inPipeline,
      scheduledAhead,
      createdInRange,
    },
    seo,
    press: { outletsFeatured, piecesOfCoverage, followUpsDue, funnel },
    directories: directoryCounts,
    weeks,
    publishedPerWeek,
    coveragePerWeek,
    upcoming,
    attention,
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;
