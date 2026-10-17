import type { ChannelTotal, DateRange } from "@/lib/seo/types";
import type { DailyChannelRow } from "@/lib/seo/transform";
import type { GoogleServiceAccount } from "./config";
import { SeoApiError, googleError } from "./errors";
import { SCOPES, getAccessToken } from "./google-auth";

// https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports

/** GA4's "Users" in the Traffic acquisition report. */
const METRIC = "activeUsers";
/** Session-scoped channel: how the visitor arrived for that session (not first-user acquisition). */
const CHANNEL = "sessionDefaultChannelGroup";

interface ReportRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}

interface BatchRunReportsResponse {
  reports?: { rows?: ReportRow[] }[];
}

/** GA4 returns dates as YYYYMMDD. */
function toIsoDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function metricValue(row: ReportRow): number {
  return Number(row.metricValues?.[0]?.value ?? 0);
}

export interface ChannelTraffic {
  rows: DailyChannelRow[];
  channelTotals: ChannelTotal[];
  totalUsers: number;
}

/**
 * Three reports in one request, because user counts don't add up across days
 * or channels: daily users per channel (for the chart), period users per
 * channel (for the breakdown), and period users site-wide (the headline total).
 */
export async function fetchChannelTraffic(
  account: GoogleServiceAccount,
  propertyId: string,
  range: DateRange,
): Promise<ChannelTraffic> {
  const token = await getAccessToken(account, SCOPES.analytics);
  const dateRanges = [{ startDate: range.startDate, endDate: range.endDate }];
  const metrics = [{ name: METRIC }];

  let response: Response;
  try {
    response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            { dateRanges, metrics, dimensions: [{ name: "date" }, { name: CHANNEL }], limit: 100000 },
            { dateRanges, metrics, dimensions: [{ name: CHANNEL }], limit: 1000 },
            { dateRanges, metrics },
          ],
        }),
        cache: "no-store",
      },
    );
  } catch {
    throw new SeoApiError("upstream_error", "Couldn't reach the Google Analytics Data API.");
  }
  if (!response.ok) throw await googleError(response, "Google Analytics");

  const body = (await response.json()) as BatchRunReportsResponse;
  const [daily, byChannel, total] = body.reports ?? [];

  return {
    rows: (daily?.rows ?? []).map((row) => ({
      date: toIsoDate(row.dimensionValues?.[0]?.value ?? ""),
      channel: row.dimensionValues?.[1]?.value ?? "Unassigned",
      users: metricValue(row),
    })),
    channelTotals: (byChannel?.rows ?? []).map((row) => ({
      channel: row.dimensionValues?.[0]?.value ?? "Unassigned",
      users: metricValue(row),
    })),
    totalUsers: total?.rows?.[0] ? metricValue(total.rows[0]) : 0,
  };
}
