"use client";

import { useEffect, useRef, useState } from "react";
import type { DateRange, SeoErrorCode, SeoErrorResponse } from "@/lib/seo/types";

export interface ReportError {
  status: number;
  code?: SeoErrorCode;
  message: string;
  details?: string;
  missing?: string[];
}

export interface ReportState<T> {
  data: T | null;
  error: ReportError | null;
  /** A request is in flight. When `data` is set too, it's the previous result, kept on screen. */
  isFetching: boolean;
}

export interface RefreshSignal {
  /** Incremented to refetch. */
  nonce: number;
  /** Ask the server to skip its cache (manual refresh). */
  fresh: boolean;
}

// Recent responses, so flipping back to a range you just viewed is instant.
const CLIENT_TTL_MS = 5 * 60 * 1000;
const clientCache = new Map<string, { data: unknown; storedAt: number }>();

async function toReportError(response: Response): Promise<ReportError> {
  try {
    const body = (await response.json()) as Partial<SeoErrorResponse> & { details?: unknown };
    return {
      status: response.status,
      code: body.code,
      message: body.error ?? `Request failed (HTTP ${response.status})`,
      details: typeof body.details === "string" ? body.details : undefined,
      missing: body.missing,
    };
  } catch {
    return { status: response.status, message: `Request failed (HTTP ${response.status})` };
  }
}

/**
 * Loads one SEO report for a date range. Changing the range aborts the
 * previous request, and a response is only applied if it belongs to the
 * latest request, so fast clicking through ranges can't show stale numbers.
 */
export function useSeoReport<T>(path: string, range: DateRange | null, refresh: RefreshSignal): ReportState<T> {
  const [state, setState] = useState<ReportState<T>>({ data: null, error: null, isFetching: range !== null });
  const latestRequest = useRef(0);
  const lastNonce = useRef(refresh.nonce);

  const key = range ? `${path}?startDate=${range.startDate}&endDate=${range.endDate}` : null;

  useEffect(() => {
    if (!key) return;

    const forced = lastNonce.current !== refresh.nonce;
    lastNonce.current = refresh.nonce;

    const hit = clientCache.get(key);
    if (!forced && hit && Date.now() - hit.storedAt < CLIENT_TTL_MS) {
      setState({ data: hit.data as T, error: null, isFetching: false });
      return;
    }

    const requestId = ++latestRequest.current;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, isFetching: true }));

    const url = forced && refresh.fresh ? `${key}&fresh=1` : key;
    fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw await toReportError(response);
        return (await response.json()) as T;
      })
      .then((data) => {
        if (requestId !== latestRequest.current) return;
        clientCache.set(key, { data, storedAt: Date.now() });
        setState({ data, error: null, isFetching: false });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || requestId !== latestRequest.current) return;
        const error: ReportError =
          err && typeof err === "object" && "status" in err
            ? (err as ReportError)
            : { status: 0, message: "Network error", details: "Check your connection and try again." };
        setState((prev) => ({ ...prev, error, isFetching: false }));
      });

    return () => controller.abort();
  }, [key, refresh.nonce, refresh.fresh]);

  return state;
}
