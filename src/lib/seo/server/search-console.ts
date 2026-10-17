import type { DateRange } from "@/lib/seo/types";
import type { DailySearchRow } from "@/lib/seo/transform";
import type { GoogleServiceAccount } from "./config";
import { SeoApiError, googleError } from "./errors";
import { SCOPES, getAccessToken } from "./google-auth";

// https://developers.google.com/webmaster-tools/v1/searchanalytics/query

interface SearchAnalyticsResponse {
  rows?: { keys: string[]; clicks: number; impressions: number }[];
}

/**
 * Daily Google Search (web) clicks and impressions for the whole property.
 * Uses the default "final" data state, so the most recent 2–3 days are absent
 * until Google finishes processing them.
 */
export async function fetchSearchPerformance(
  account: GoogleServiceAccount,
  siteUrl: string,
  range: DateRange,
): Promise<DailySearchRow[]> {
  const token = await getAccessToken(account, SCOPES.searchConsole);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ["date"],
        type: "web",
        rowLimit: 25000,
      }),
      cache: "no-store",
    });
  } catch {
    throw new SeoApiError("upstream_error", "Couldn't reach the Search Console API.");
  }
  if (!response.ok) throw await googleError(response, "Search Console");

  const body = (await response.json()) as SearchAnalyticsResponse;
  return (body.rows ?? []).map((row) => ({
    date: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
  }));
}
