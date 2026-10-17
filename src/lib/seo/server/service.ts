import { buildSearchPerformance, buildTrafficChannels } from "@/lib/seo/transform";
import type { DateRange, SearchPerformanceResponse, TrafficChannelsResponse } from "@/lib/seo/types";
import { fetchChannelTraffic } from "./analytics-data";
import { cached } from "./cache";
import { analyticsConfig, isDemoMode, searchConsoleConfig } from "./config";
import { DEMO_PROPERTY, demoChannelTraffic, demoSearchRows } from "./demo";
import { SeoApiError } from "./errors";
import { fetchSearchPerformance } from "./search-console";

interface Options {
  /** Skip the cache (manual refresh). */
  fresh?: boolean;
}

export async function getSearchPerformance(range: DateRange, options: Options = {}): Promise<SearchPerformanceResponse> {
  if (isDemoMode()) {
    return buildSearchPerformance({ range, rows: demoSearchRows(range), property: DEMO_PROPERTY, source: "demo" });
  }

  const config = searchConsoleConfig();
  if (!config.ok) throw new SeoApiError("not_configured", undefined, config.missing);
  const { account, siteUrl } = config.value;

  return cached(
    `gsc|${siteUrl}|${range.startDate}|${range.endDate}`,
    async () => {
      const rows = await fetchSearchPerformance(account, siteUrl, range);
      return buildSearchPerformance({ range, rows, property: siteUrl, source: "live" });
    },
    options,
  );
}

export async function getTrafficChannels(range: DateRange, options: Options = {}): Promise<TrafficChannelsResponse> {
  if (isDemoMode()) {
    return buildTrafficChannels({ range, ...demoChannelTraffic(range), source: "demo" });
  }

  const config = analyticsConfig();
  if (!config.ok) throw new SeoApiError("not_configured", undefined, config.missing);
  const { account, propertyId } = config.value;

  return cached(
    `ga4|${propertyId}|${range.startDate}|${range.endDate}`,
    async () => {
      const traffic = await fetchChannelTraffic(account, propertyId, range);
      return buildTrafficChannels({ range, ...traffic, source: "live" });
    },
    options,
  );
}
