import { ISO_DATE, addDays, toIsoDate, validateRange } from "@/lib/seo/dates";
import { z } from "@/lib/zod";

const isoDate = z.string().regex(ISO_DATE, "Use YYYY-MM-DD");

/** The query parameters as plain fields, for OpenAPI. Validate requests with `seoRangeQuerySchema`. */
export const seoRangeQueryFields = z.object({
  startDate: isoDate.openapi({ example: "2026-09-18", description: "Inclusive start date (YYYY-MM-DD)." }),
  endDate: isoDate.openapi({ example: "2026-10-15", description: "Inclusive end date (YYYY-MM-DD)." }),
  fresh: z
    .enum(["1", "true"])
    .optional()
    .openapi({ description: "Bypass the 5-minute server cache (used by the Refresh button)." }),
});

export const seoRangeQuerySchema = seoRangeQueryFields.superRefine((value, ctx) => {
  // Viewers ahead of UTC can legitimately ask for "tomorrow" in UTC terms.
  const latestAllowed = addDays(toIsoDate(new Date()), 1);
  const problem = validateRange({ startDate: value.startDate, endDate: value.endDate }, latestAllowed);
  if (problem) ctx.addIssue({ code: "custom", path: ["endDate"], message: problem });
});

const dataSource = z
  .enum(["live", "demo"])
  .openapi({ description: '"demo" responses are synthetic development data, never analytics.' });

const dateRange = z.object({ startDate: z.string(), endDate: z.string() });

export const searchPerformanceResponseSchema = z
  .object({
    source: dataSource,
    fetchedAt: z.string().openapi({ description: "When the server fetched these numbers from Google." }),
    range: dateRange,
    availableThrough: z.string().nullable().openapi({ description: "Latest date Search Console has final data for." }),
    property: z.string().openapi({ example: "sc-domain:zedu.chat" }),
    points: z.array(
      z.object({
        date: z.string(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number().nullable().openapi({ description: "Percent; null when there were no impressions." }),
      }),
    ),
    totals: z.object({ clicks: z.number(), impressions: z.number(), ctr: z.number().nullable() }),
  })
  .openapi("SearchPerformance");

export const trafficChannelsResponseSchema = z
  .object({
    source: dataSource,
    fetchedAt: z.string(),
    range: dateRange,
    availableThrough: z.string().nullable(),
    metric: z.literal("activeUsers"),
    channels: z
      .array(z.object({ channel: z.string(), users: z.number() }))
      .openapi({ description: "Period users per sessionDefaultChannelGroup, deduplicated within each channel." }),
    totalUsers: z.number().openapi({ description: "Site-wide period users, deduplicated by GA4 (not a sum of channels)." }),
    points: z.array(z.object({ date: z.string(), users: z.record(z.string(), z.number()) })),
  })
  .openapi("TrafficChannels");

export const seoErrorResponseSchema = z
  .object({
    error: z.string(),
    code: z.enum(["not_configured", "invalid_credentials", "permission_denied", "rate_limited", "upstream_error"]),
    details: z.string().optional(),
    missing: z.array(z.string()).optional().openapi({ description: "Names of unset environment variables." }),
  })
  .openapi("SeoError");
