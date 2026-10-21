import { outletKey } from "@/lib/outlet-key";
import { apiFetch } from "@/lib/request-json";

export type RecordType = "Press Coverage" | "Press Submission";

export const ARTICLE_TYPES = [
  "News Article",
  "Interview",
  "Feature Story",
  "Press Release",
  "Opinion / Commentary",
  "Partner / Sponsored Content",
  "Broadcast / Podcast Appearance",
  "Other",
] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const PITCH_STATUSES = ["Submitted", "Under Review", "Changes Requested", "Accepted"] as const;
export type PitchStatus = (typeof PITCH_STATUSES)[number];
export type SubmissionStatus = "Draft" | PitchStatus | "Published" | "Rejected" | "Withdrawn";

/** A record as `/api/media` returns it: either a piece of coverage or a submission. */
export type ApiRecord = {
  id: string;
  recordType: RecordType;
  articleType: ArticleType | "";
  articleTypeOther?: string;
  title: string;
  outlet: string;
  publicationDate?: string;
  dateSubmitted?: string;
  status?: string;
  responsiblePerson?: string;
  followUpDate?: string;
  articleUrl?: string;
  documentUrl?: string;
  notes?: string;
  linkedCoverageId?: string;
  outletId?: string;
};

/** Outlet details as `/api/media/outlets` returns them. */
export type OutletDetails = {
  id: string;
  name: string;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  tier: "Tier 1" | "Tier 2" | "Tier 3" | null;
  notes: string | null;
};

/** Where an outlet or story is on the way to being featured. */
export type Stage = "Target" | "Pitched" | "Featured" | "Closed";

export type PressItem = {
  id: string;
  stage: Stage;
  outlet: string;
  title: string;
  articleType: ArticleType | "";
  articleTypeOther?: string;
  status: SubmissionStatus;
  date?: string;
  followUpDate?: string;
  owner?: string;
  url?: string;
  draftUrl?: string;
  notes?: string;
  coverage?: ApiRecord;
  submission?: ApiRecord;
};

export type OutletSummary = {
  key: string;
  name: string;
  stage: Stage;
  features: number;
  openPitches: number;
  targets: number;
  lastActivity?: string;
};

const STAGE_RANK: Record<Stage, number> = { Featured: 3, Pitched: 2, Target: 1, Closed: 0 };

export const today = () => new Date().toISOString().slice(0, 10);

export function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value?: string) {
  const parsed = parseDate(value);
  if (!parsed) return "–";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

export function articleTypeLabel(item: Pick<PressItem, "articleType" | "articleTypeOther">) {
  if (item.articleType === "Other") return item.articleTypeOther?.trim() || "Other";
  return item.articleType;
}

export { outletKey };

function stageForSubmission(status: SubmissionStatus): Stage {
  if (status === "Draft") return "Target";
  if (status === "Published") return "Featured";
  if (status === "Rejected" || status === "Withdrawn") return "Closed";
  return "Pitched";
}

/**
 * Turns coverage and submissions into one journey item each. A submission that was linked to
 * coverage when it got published is folded into that coverage instead of showing twice.
 */
export function deriveItems(records: ApiRecord[]): PressItem[] {
  const coverageIds = new Set(records.filter((r) => r.recordType === "Press Coverage").map((r) => r.id));
  const pitchFor = new Map<string, ApiRecord>();
  for (const record of records) {
    if (record.recordType === "Press Submission" && record.linkedCoverageId && coverageIds.has(record.linkedCoverageId)) {
      pitchFor.set(record.linkedCoverageId, record);
    }
  }

  return records.flatMap((record): PressItem[] => {
    if (record.recordType === "Press Coverage") {
      const pitch = pitchFor.get(record.id);
      return [
        {
          id: record.id,
          stage: "Featured",
          outlet: record.outlet,
          title: record.title,
          articleType: record.articleType,
          articleTypeOther: record.articleTypeOther,
          status: "Published",
          date: record.publicationDate,
          owner: pitch?.responsiblePerson,
          url: record.articleUrl,
          notes: record.notes,
          coverage: record,
          submission: pitch,
        },
      ];
    }
    if (record.linkedCoverageId && coverageIds.has(record.linkedCoverageId)) return [];

    const status = (record.status as SubmissionStatus | undefined) ?? "Draft";
    return [
      {
        id: record.id,
        stage: stageForSubmission(status),
        outlet: record.outlet,
        title: record.title,
        articleType: record.articleType,
        articleTypeOther: record.articleTypeOther,
        status,
        date: record.dateSubmitted,
        followUpDate: record.followUpDate,
        owner: record.responsiblePerson,
        url: record.articleUrl,
        draftUrl: record.documentUrl,
        notes: record.notes,
        submission: record,
      },
    ];
  });
}

export function groupByOutlet(items: PressItem[]): OutletSummary[] {
  const groups = new Map<string, OutletSummary>();
  for (const item of items) {
    const key = outletKey(item.outlet);
    if (!key) continue;
    const group = groups.get(key) ?? {
      key,
      name: item.outlet.trim(),
      stage: item.stage,
      features: 0,
      openPitches: 0,
      targets: 0,
    };
    if (STAGE_RANK[item.stage] > STAGE_RANK[group.stage]) group.stage = item.stage;
    if (item.stage === "Featured") group.features += 1;
    if (item.stage === "Pitched") group.openPitches += 1;
    if (item.stage === "Target") group.targets += 1;
    if (item.date && (!group.lastActivity || item.date > group.lastActivity)) group.lastActivity = item.date;
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => STAGE_RANK[b.stage] - STAGE_RANK[a.stage] || (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "")
  );
}

export function isFollowUpDue(item: PressItem) {
  return item.stage === "Pitched" && Boolean(item.followUpDate) && (item.followUpDate as string) <= today();
}

/** The full body `/api/media/[id]` expects when updating a submission. */
export function submissionPayload(record: ApiRecord, overrides: Partial<ApiRecord> = {}) {
  const merged = { ...record, ...overrides };
  return {
    recordType: "Press Submission" as const,
    articleType: merged.articleType ?? "",
    articleTypeOther: merged.articleTypeOther ?? "",
    title: merged.title,
    outlet: merged.outlet,
    dateSubmitted: merged.dateSubmitted ?? "",
    status: merged.status ?? "Draft",
    responsiblePerson: merged.responsiblePerson ?? "",
    followUpDate: merged.followUpDate ?? "",
    articleUrl: merged.articleUrl ?? "",
    documentUrl: merged.documentUrl ?? "",
    notes: merged.notes ?? "",
    linkedCoverageId: merged.linkedCoverageId,
  };
}

export async function sendJson<T>(url: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  const response = await apiFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string; details?: Record<string, string[]> })
    | null;
  if (!response.ok) {
    const detail = data?.details ? Object.values(data.details).flat()[0] : undefined;
    throw new Error(detail ?? data?.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}
