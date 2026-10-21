"use client";

import { ErrorState } from "@/components/ErrorState";

// Renders inside the dashboard layout, so the sidebar stays usable while a page is broken.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState digest={error.digest} onRetry={reset} />;
}
