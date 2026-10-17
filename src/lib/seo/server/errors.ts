import type { SeoErrorCode, SeoErrorResponse } from "@/lib/seo/types";

const STATUS: Record<SeoErrorCode, number> = {
  not_configured: 503,
  invalid_credentials: 502,
  permission_denied: 502,
  rate_limited: 429,
  upstream_error: 502,
};

const TITLE: Record<SeoErrorCode, string> = {
  not_configured: "Analytics connection not configured",
  invalid_credentials: "Google rejected the service account credentials",
  permission_denied: "The service account can't access this property",
  rate_limited: "Google API quota exceeded",
  upstream_error: "Google API request failed",
};

export class SeoApiError extends Error {
  constructor(
    readonly code: SeoErrorCode,
    readonly details?: string,
    readonly missing?: string[],
  ) {
    super(TITLE[code]);
  }

  get status(): number {
    return STATUS[this.code];
  }

  toResponse(): SeoErrorResponse {
    return {
      error: this.message,
      code: this.code,
      ...(this.details ? { details: this.details } : {}),
      ...(this.missing?.length ? { missing: this.missing } : {}),
    };
  }
}

/** Turns a failed Google API response into a typed error, keeping Google's explanation. */
export async function googleError(response: Response, service: string): Promise<SeoApiError> {
  let message = `${service} responded with HTTP ${response.status}.`;
  try {
    const body = (await response.json()) as { error?: { message?: string } | string; error_description?: string };
    const detail = typeof body.error === "string" ? body.error_description ?? body.error : body.error?.message;
    if (detail) message = `${service}: ${detail}`;
  } catch {
    // Non-JSON body: keep the status-only message.
  }

  if (response.status === 401) return new SeoApiError("invalid_credentials", message);
  if (response.status === 403) return new SeoApiError("permission_denied", message);
  if (response.status === 429) return new SeoApiError("rate_limited", message);
  return new SeoApiError("upstream_error", message);
}
