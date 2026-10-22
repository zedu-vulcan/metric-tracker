"use client";

import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/lib/request-json";
import type { SearchResponse, SearchResult } from "@/lib/schemas/search";
import { useDebouncedValue } from "./useDebouncedValue";

type SearchStatus = "idle" | "loading" | "success" | "error";
type SearchData = { query: string; data: SearchResponse };

export function useGlobalSearch(open: boolean) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchData | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [retryKey, setRetryKey] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);
  const normalizedQuery = debouncedQuery.trim();

  useEffect(() => {
    if (open) return;
    setQuery("");
    setData(null);
    setStatus("idle");
    setRetryKey(0);
  }, [open]);

  useEffect(() => {
    if (!open || normalizedQuery.length < 2 || normalizedQuery.length > 100) {
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");

    void requestJson<SearchResponse>(
      `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setData({ query: normalizedQuery, data: response });
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [open, normalizedQuery, retryKey]);

  const retry = useCallback(() => setRetryKey((current) => current + 1), []);
  const results: SearchResult[] =
    data?.query === normalizedQuery && normalizedQuery.length >= 2 && normalizedQuery.length <= 100
      ? data.data.results
      : [];

  return { query, setQuery, status, results, retry, normalizedQuery };
}
