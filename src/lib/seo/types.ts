// Shared between the SEO API routes and the dashboard UI. Keep this file free of server-only imports.

/** Where a response's numbers came from. "demo" is synthetic and must never be presented as analytics. */
export type DataSource = "live" | "demo";

export interface DateRange {
  /** Inclusive, YYYY-MM-DD */
  startDate: string;
  /** Inclusive, YYYY-MM-DD */
  endDate: string;
}

export interface SearchPerformancePoint {
  date: string;
  clicks: number;
  impressions: number;
  /** Percentage (0–100), or null when the day had no impressions. */
  ctr: number | null;
}

export interface SearchPerformanceResponse {
  source: DataSource;
  /** ISO timestamp of when the server fetched these numbers from Google. */
  fetchedAt: string;
  range: DateRange;
  /** Latest date Search Console returned data for, or null when it returned none. */
  availableThrough: string | null;
  /** The Search Console property queried, e.g. `sc-domain:zedu.chat`. */
  property: string;
  points: SearchPerformancePoint[];
  totals: {
    clicks: number;
    impressions: number;
    /** Percentage (0–100), or null when there were no impressions. */
    ctr: number | null;
  };
}

export interface ChannelTotal {
  /** GA4 `sessionDefaultChannelGroup` value, e.g. "Organic Search". */
  channel: string;
  /** Active users with at least one session in this channel, deduplicated within the channel for the period. */
  users: number;
}

export interface TrafficChannelsPoint {
  date: string;
  /** Active users per channel for that day. Channels with no row that day are 0. */
  users: Record<string, number>;
}

export interface TrafficChannelsResponse {
  source: DataSource;
  fetchedAt: string;
  range: DateRange;
  availableThrough: string | null;
  metric: "activeUsers";
  /** Every channel GA4 returned for the period, sorted by users (descending). */
  channels: ChannelTotal[];
  /** Active users across the whole site for the period, deduplicated by GA4 (not a sum of channels). */
  totalUsers: number;
  points: TrafficChannelsPoint[];
}

export type SeoErrorCode =
  | "not_configured"
  | "invalid_credentials"
  | "permission_denied"
  | "rate_limited"
  | "upstream_error";

export interface SeoErrorResponse {
  error: string;
  code: SeoErrorCode;
  /** Human-readable explanation, safe to show to signed-in team members. */
  details?: string;
  /** Environment variables that still need values (names only, never values). */
  missing?: string[];
}
