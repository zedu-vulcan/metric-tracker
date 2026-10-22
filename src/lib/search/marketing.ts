import { prisma } from "@/lib/prisma";
import { textMatch } from "./match";
import type { Searcher, SearchResult } from "@/lib/schemas/search";
import { displayName, statusFromDb } from "@/lib/directories";
import type { DirectoryStatus, OutletTier, SubmissionStatus } from "@prisma/client";

export type DirectorySearchRow = {
  id: string;
  name: string;
  website: string;
  status: DirectoryStatus;
  notes?: string | null;
  listingUrl?: string | null;
};

export type ContentSearchRow = {
  id: string;
  title?: string | null;
  url?: string | null;
  platform?: string | null;
  status: string;
  notes?: string | null;
  topics?: string[];
};

export type PressOutletSearchRow = {
  id: string;
  name: string;
  website?: string | null;
  tier?: OutletTier | null;
};

export type PressCoverageSearchRow = {
  id: string;
  title: string;
  outlet: string;
  summary?: string | null;
};

export type PressSubmissionSearchRow = {
  id: string;
  title: string;
  outlet: string;
  status: SubmissionStatus | string;
  notes?: string | null;
};

/**
 * Maps a Directory database row to a SearchResult.
 * Uses displayName() from @/lib/directories. If directory name is empty, displays website.
 */
export function mapDirectoryResult(row: DirectorySearchRow, q: string): SearchResult {
  const qLower = q.toLowerCase();
  const name = row.name?.trim() ?? "";
  const website = row.website?.trim() ?? "";
  const title = displayName({ name, website });

  let matchedField = "name";
  if (name.toLowerCase().includes(qLower)) {
    matchedField = "name";
  } else if (website.toLowerCase().includes(qLower)) {
    matchedField = "website";
  } else if (row.notes && row.notes.toLowerCase().includes(qLower)) {
    matchedField = "notes";
  } else if (row.listingUrl && row.listingUrl.toLowerCase().includes(qLower)) {
    matchedField = "listingUrl";
  }

  return {
    type: "directory",
    id: row.id,
    title,
    subtitle: name ? (website || null) : null,
    status: statusFromDb(row.status),
    matchedField,
    href: `/directories?q=${encodeURIComponent(title)}`,
  };
}

/**
 * Maps a ContentItem database row to a SearchResult.
 * Falls back to "Untitled content" if both title and url are missing.
 */
export function mapContentResult(row: ContentSearchRow, q: string): SearchResult {
  const qLower = q.toLowerCase();
  const title = row.title?.trim() || row.url?.trim() || "Untitled content";

  let matchedField = "title";
  if (row.title && row.title.toLowerCase().includes(qLower)) {
    matchedField = "title";
  } else if (row.url && row.url.toLowerCase().includes(qLower)) {
    matchedField = "url";
  } else if (row.platform && row.platform.toLowerCase().includes(qLower)) {
    matchedField = "platform";
  } else if (row.topics && row.topics.some((topic) => topic.toLowerCase().includes(qLower))) {
    matchedField = "topics";
  } else if (row.notes && row.notes.toLowerCase().includes(qLower)) {
    matchedField = "notes";
  }

  return {
    type: "content",
    id: row.id,
    title,
    subtitle: row.platform?.trim() || null,
    status: row.status || null,
    matchedField,
    href: `/content?q=${encodeURIComponent(title)}`,
  };
}

/**
 * Maps a PressOutlet database row to a SearchResult.
 * Contact details and notes are strictly excluded to preserve privacy.
 */
export function mapPressOutletResult(row: PressOutletSearchRow, q: string): SearchResult {
  const qLower = q.toLowerCase();
  const name = row.name?.trim() ?? "";
  const website = row.website?.trim() ?? "";

  let matchedField = "name";
  if (name.toLowerCase().includes(qLower)) {
    matchedField = "name";
  } else if (website.toLowerCase().includes(qLower)) {
    matchedField = "website";
  }

  const subtitle = row.tier ? `Tier ${row.tier.replace(/^Tier/i, "")}` : null;

  return {
    type: "press_outlet",
    id: row.id,
    title: name,
    subtitle,
    status: null,
    matchedField,
    href: `/media?q=${encodeURIComponent(name)}`,
  };
}

/**
 * Maps a PressCoverage database row to a SearchResult.
 */
export function mapPressCoverageResult(row: PressCoverageSearchRow, q: string): SearchResult {
  const qLower = q.toLowerCase();
  const title = row.title?.trim() ?? "";
  const outlet = row.outlet?.trim() ?? "";

  let matchedField = "title";
  if (title.toLowerCase().includes(qLower)) {
    matchedField = "title";
  } else if (outlet.toLowerCase().includes(qLower)) {
    matchedField = "outlet";
  } else if (row.summary && row.summary.toLowerCase().includes(qLower)) {
    matchedField = "summary";
  }

  return {
    type: "press_coverage",
    id: row.id,
    title,
    subtitle: outlet || null,
    status: null,
    matchedField,
    href: `/media?q=${encodeURIComponent(title)}`,
  };
}

/**
 * Maps a PressSubmission database row to a SearchResult.
 */
export function mapPressSubmissionResult(row: PressSubmissionSearchRow, q: string): SearchResult {
  const qLower = q.toLowerCase();
  const title = row.title?.trim() ?? "";
  const outlet = row.outlet?.trim() ?? "";

  let matchedField = "title";
  if (title.toLowerCase().includes(qLower)) {
    matchedField = "title";
  } else if (outlet.toLowerCase().includes(qLower)) {
    matchedField = "outlet";
  } else if (row.notes && row.notes.toLowerCase().includes(qLower)) {
    matchedField = "notes";
  }

  return {
    type: "press_submission",
    id: row.id,
    title,
    subtitle: outlet || null,
    status: row.status ? String(row.status) : null,
    matchedField,
    href: `/media?q=${encodeURIComponent(title)}`,
  };
}

export const searchDirectories: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const rows = await prisma.directory.findMany({
    where: {
      projectId,
      OR: [
        { name: match },
        { website: match },
        { notes: match },
        { listingUrl: match },
      ],
    },
    select: {
      id: true,
      name: true,
      website: true,
      status: true,
      notes: true,
      listingUrl: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => mapDirectoryResult(row, q));
};

export const searchContent: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const rows = await prisma.contentItem.findMany({
    where: {
      projectId,
      OR: [
        { title: match },
        { url: match },
        { platform: match },
        { notes: match },
        { topics: { has: q } },
      ],
    },
    select: {
      id: true,
      title: true,
      url: true,
      platform: true,
      status: true,
      notes: true,
      topics: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => mapContentResult(row, q));
};

export const searchPressOutlets: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const rows = await prisma.pressOutlet.findMany({
    where: {
      projectId,
      OR: [
        { name: match },
        { website: match },
      ],
    },
    select: {
      id: true,
      name: true,
      website: true,
      tier: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => mapPressOutletResult(row, q));
};

export const searchPressCoverage: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const rows = await prisma.pressCoverage.findMany({
    where: {
      projectId,
      OR: [
        { title: match },
        { outlet: match },
        { summary: match },
      ],
    },
    select: {
      id: true,
      title: true,
      outlet: true,
      summary: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => mapPressCoverageResult(row, q));
};

export const searchPressSubmissions: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const rows = await prisma.pressSubmission.findMany({
    where: {
      projectId,
      OR: [
        { title: match },
        { outlet: match },
        { notes: match },
      ],
    },
    select: {
      id: true,
      title: true,
      outlet: true,
      status: true,
      notes: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => mapPressSubmissionResult(row, q));
};
