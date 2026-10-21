import type { $Enums, Prisma, PressCoverage, PressOutlet, PressSubmission } from "@prisma/client";
import { outletKey } from "@/lib/outlet-key";

const ARTICLE_TYPE_TO_DB: Record<string, $Enums.ArticleType> = {
  "News Article": "NewsArticle",
  Interview: "Interview",
  "Feature Story": "FeatureStory",
  "Press Release": "PressRelease",
  "Opinion / Commentary": "OpinionCommentary",
  "Partner / Sponsored Content": "PartnerSponsoredContent",
  "Broadcast / Podcast Appearance": "BroadcastPodcastAppearance",
  Other: "Other",
};

const SUBMISSION_STATUS_TO_DB: Record<string, $Enums.SubmissionStatus> = {
  Draft: "Draft",
  Submitted: "Submitted",
  "Under Review": "UnderReview",
  "Changes Requested": "ChangesRequested",
  Accepted: "Accepted",
  Published: "Published",
  Rejected: "Rejected",
  Withdrawn: "Withdrawn",
};

const invert = <T extends string>(map: Record<string, T>) =>
  Object.fromEntries(Object.entries(map).map(([label, value]) => [value, label])) as Record<T, string>;

const ARTICLE_TYPE_FROM_DB = invert(ARTICLE_TYPE_TO_DB);
const SUBMISSION_STATUS_FROM_DB = invert(SUBMISSION_STATUS_TO_DB);

/** An empty label means "not set yet" and is stored as null. */
export function articleTypeToDb(label: string): $Enums.ArticleType | null {
  return label ? (ARTICLE_TYPE_TO_DB[label] ?? "Other") : null;
}

export function submissionStatusToDb(label: string | undefined): $Enums.SubmissionStatus {
  return (label && SUBMISSION_STATUS_TO_DB[label]) || "Draft";
}

export function dateOrNull(value: string | undefined) {
  return value ? new Date(value) : null;
}

/**
 * Targets (Draft) haven't been pitched, so they have no submission date. Anything further along
 * keeps the date it has, or gets today when none was ever recorded.
 */
export function submissionDate(status: $Enums.SubmissionStatus, input: string | undefined, existing?: Date | null) {
  if (input) return new Date(input);
  if (status === "Draft") return null;
  return existing ?? new Date();
}

const isoDate = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : undefined);

export function normalizeCoverage(record: PressCoverage) {
  return {
    id: record.id,
    recordType: "Press Coverage",
    articleType: record.articleType ? ARTICLE_TYPE_FROM_DB[record.articleType] : "",
    articleTypeOther: record.articleTypeOther ?? undefined,
    title: record.title,
    outlet: record.outlet,
    publicationDate: isoDate(record.publicationDate),
    articleUrl: record.publishedArticleUrl ?? undefined,
    notes: record.summary ?? undefined,
    status: "Published",
    outletId: record.outletId ?? undefined,
  };
}

export function normalizeSubmission(record: PressSubmission) {
  return {
    id: record.id,
    recordType: "Press Submission",
    articleType: record.articleType ? ARTICLE_TYPE_FROM_DB[record.articleType] : "",
    articleTypeOther: record.articleTypeOther ?? undefined,
    title: record.title,
    outlet: record.outlet,
    dateSubmitted: isoDate(record.dateSubmitted),
    status: SUBMISSION_STATUS_FROM_DB[record.status] ?? record.status,
    responsiblePerson: record.responsiblePerson ?? undefined,
    followUpDate: isoDate(record.followUpDate),
    documentUrl: record.draftUrl ?? undefined,
    articleUrl: record.publishedArticleUrl ?? undefined,
    notes: record.notes ?? undefined,
    linkedCoverageId: record.coverageId ?? undefined,
    outletId: record.outletId ?? undefined,
  };
}

const TIER_TO_DB: Record<string, $Enums.OutletTier> = { "Tier 1": "Tier1", "Tier 2": "Tier2", "Tier 3": "Tier3" };
const TIER_FROM_DB = invert(TIER_TO_DB);

export const tierToDb = (label: string | null) => (label ? TIER_TO_DB[label] : null);

export function serializeOutlet(outlet: PressOutlet) {
  return {
    id: outlet.id,
    name: outlet.name,
    website: outlet.website,
    contactName: outlet.contactName,
    contactEmail: outlet.contactEmail,
    tier: outlet.tier ? TIER_FROM_DB[outlet.tier] : null,
    notes: outlet.notes,
  };
}

/** Finds the outlet for a name (creating it the first time) and returns its id. */
export async function resolveOutletId(db: Prisma.TransactionClient, projectId: string, name: string) {
  const key = outletKey(name);
  if (!key) return null;
  const outlet = await db.pressOutlet.upsert({
    where: { projectId_key: { projectId, key } },
    create: { projectId, name: name.trim(), key },
    update: {},
    select: { id: true },
  });
  return outlet.id;
}
