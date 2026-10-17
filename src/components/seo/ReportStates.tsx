import { CircleAlertIcon, InboxIcon, PlugZapIcon, RefreshCwIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { ReportError } from "./useSeoReport";

/** Reserves the chart's height so the page doesn't jump when data arrives. */
export function ReportLoading({ label }: { label: string }) {
  return (
    <div className="flex h-80 items-center justify-center gap-2 text-[13px] text-muted-foreground">
      <Spinner aria-hidden="true" />
      <span role="status">{label}</span>
    </div>
  );
}

export function ReportEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="h-80">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function NotConfigured({ service, error }: { service: string; error: ReportError }) {
  return (
    <Empty className="h-80">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PlugZapIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Connect {service}</EmptyTitle>
        <EmptyDescription>
          This chart shows live data once the server has Google service-account credentials. See “SEO Analytics” in
          the README for setup.
        </EmptyDescription>
      </EmptyHeader>
      {error.missing && error.missing.length > 0 && (
        <EmptyContent>
          <span className="text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase">
            Missing environment variables
          </span>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0">
            {error.missing.map((name) => (
              <li key={name} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                {name}
              </li>
            ))}
          </ul>
        </EmptyContent>
      )}
    </Empty>
  );
}

export function ReportErrorState({
  service,
  error,
  onRetry,
  compact,
}: {
  service: string;
  error: ReportError;
  onRetry: () => void;
  /** Inline above existing data instead of replacing the chart. */
  compact?: boolean;
}) {
  if (error.code === "not_configured" && !compact) return <NotConfigured service={service} error={error} />;

  const description =
    error.status === 401
      ? "Your session has expired. Reload the page to sign in again."
      : error.code === "rate_limited"
        ? `${error.details ?? "Google's API quota is used up for now."} Try again in a few minutes.`
        : error.details ?? "Something went wrong while loading this report.";

  const alert = (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden="true" />
      <AlertTitle>{error.message}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
          Retry
        </Button>
      </AlertAction>
    </Alert>
  );

  return compact ? alert : <div className="flex min-h-80 items-center px-4 py-6 sm:px-5">{alert}</div>;
}
