import { FlaskConicalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DataSource } from "@/lib/seo/types";

interface ReportSectionProps {
  id: string;
  title: string;
  subtitle: string;
  source?: DataSource;
  /** Data provider shown next to the title, e.g. "Search Console". */
  provider: string;
  busy?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** One report: a white sheet with title, provenance and a footnote strip. */
export function ReportSection({ id, title, subtitle, source, provider, busy, footer, children }: ReportSectionProps) {
  const titleId = `${id}-title`;
  return (
    <section
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      className="flex min-w-0 flex-col rounded-xl border bg-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="m-0 text-[13px] font-bold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          <p className="m-0 max-w-[60ch] text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
        {source === "demo" ? (
          <Badge variant="warning" className="shrink-0">
            <FlaskConicalIcon aria-hidden="true" />
            Demo data — not live analytics
          </Badge>
        ) : (
          <span className="shrink-0 text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase">
            {provider}
          </span>
        )}
      </header>

      <div className={cn("flex min-w-0 flex-col transition-opacity", busy && "opacity-60")}>{children}</div>

      {footer && (
        <footer className="mt-auto border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">{footer}</footer>
      )}
    </section>
  );
}

/** A label/value cell in a hairline-divided summary strip. */
export function SummaryStat({
  label,
  value,
  hint,
  swatch,
}: {
  label: React.ReactNode;
  value: string;
  hint?: string;
  swatch?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase">
        {swatch && <span aria-hidden="true" className={cn("h-0.5 w-3 rounded-full", swatch)} />}
        {label}
      </span>
      <span className="truncate font-mono text-xl leading-tight font-medium tracking-[-0.02em] text-foreground">
        {value}
      </span>
      {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
