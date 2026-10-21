"use client";

import { useState } from "react";
import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { OverviewSummary } from "@/lib/schemas/overview";
import { apiFetch } from "@/lib/request-json";

const SECTIONS = [
  { key: "highlights", label: "Going well" },
  { key: "risks", label: "Slipping" },
  { key: "nextSteps", label: "Next steps" },
] as const;

export function AiSummaryButton() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function generate() {
    setIsGenerating(true);
    setError("");
    try {
      const response = await apiFetch("/api/overview/summary", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Couldn't generate a summary. Try again.");
        return;
      }
      setSummary(body as OverviewSummary);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function openDialog() {
    setOpen(true);
    if (!summary && !isGenerating) void generate();
  }

  const generatedAt = summary
    ? new Date(summary.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <Button onClick={openDialog}>
        <SparklesIcon data-icon="inline-start" aria-hidden="true" />
        Generate AI summary
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>AI summary</DialogTitle>
            <DialogDescription>
              {generatedAt ? `Generated ${generatedAt} from the numbers on this page.` : "Based on the numbers on this page."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isGenerating && !summary ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            summary && (
              <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto" aria-busy={isGenerating}>
                <p className="m-0 text-[15px] font-semibold text-foreground">{summary.headline}</p>
                {SECTIONS.map(({ key, label }) =>
                  summary[key].length === 0 ? null : (
                    <section key={key} className="flex flex-col gap-1.5">
                      <h3 className="m-0 text-2xs font-bold uppercase tracking-[0.07em] text-muted-foreground">{label}</h3>
                      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
                        {summary[key].map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </section>
                  )
                )}
              </div>
            )
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => void generate()} disabled={isGenerating}>
              {isGenerating ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {summary ? "Regenerate" : "Try again"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
