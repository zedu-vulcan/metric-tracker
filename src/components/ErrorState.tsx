"use client";

import Link from "next/link";
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The body of the error pages: what went wrong, a retry, and a way back. Mirrors the 404 page's look. */
export function ErrorState({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="relative mb-8 flex items-center justify-center select-none" aria-hidden="true">
        <span className="relative z-1 flex size-24 items-center justify-center rounded-[28px] border border-border-strong bg-linear-160 from-warning-muted to-background text-warning">
          <TriangleAlertIcon className="size-10" strokeWidth={1.5} />
        </span>
        <div className="pointer-events-none absolute -inset-16 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-size-[28px_28px] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_30%,transparent_100%)]" />
      </div>

      <div className="flex max-w-100 flex-col items-center gap-2.5 text-center">
        <h1 className="m-0 text-[clamp(18px,3vw,24px)] font-bold tracking-[-0.03em] text-foreground">
          Something went wrong
        </h1>
        <p className="mb-2 text-sm/relaxed text-balance text-muted-foreground">
          This page hit an unexpected error. Your data is safe. Try again, and if it keeps happening, send the
          reference below to the team.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="lg" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Back to tasks</Link>
          </Button>
        </div>
        {digest && (
          <p className="m-0 mt-3 text-xs text-muted-foreground">
            Reference <span className="font-mono text-foreground select-all">{digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
