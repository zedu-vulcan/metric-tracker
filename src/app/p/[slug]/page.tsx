import Link from "next/link";
import {
  ArrowUpRightIcon,
  CircleCheckIcon,
  FileTextIcon,
  FolderOpenIcon,
  NewspaperIcon,
  ScanSearchIcon,
  type LucideIcon,
} from "lucide-react";
import { ChartLegend, GroupedWeeklyBars } from "@/components/charts/WeeklyCharts";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { AiSummaryButton } from "@/components/overview/AiSummaryButton";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectHref } from "@/lib/project-paths";
import { OVERVIEW_WEEKS as WEEKS, getOverview, shortDate, type AttentionItem } from "@/lib/overview";
import { getProjectPage } from "@/lib/project-page";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CHANNEL_ICON: Record<AttentionItem["channel"], LucideIcon> = {
  Press: NewspaperIcon,
  SEO: ScanSearchIcon,
  Content: FileTextIcon,
  Directories: FolderOpenIcon,
};

export default async function DashboardPage({ params }: { params: { slug: string } }) {
  const { session, project } = await getProjectPage(params.slug);
  const base = projectHref(project.slug);
  const overview = await getOverview(project.id, base);
  const firstName = session?.user?.name?.split(" ")[0];

  const { published, publishedThisMonth, inPipeline, scheduledAhead, createdInRange } = overview.content;
  const { seo, weeks, publishedPerWeek, coveragePerWeek, upcoming, attention } = overview;
  const { outletsFeatured, piecesOfCoverage, followUpsDue } = overview.press;
  const directories = overview.directories;

  const funnel = [
    { stage: "Targets", hint: "Not pitched yet", count: overview.press.funnel.targets, bar: "bg-chart-2" },
    { stage: "Pitched", hint: "Waiting on the outlet", count: overview.press.funnel.pitched, bar: "bg-primary/60" },
    { stage: "Featured", hint: "Published", count: overview.press.funnel.featured, bar: "bg-primary" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((step) => step.count));
  const closedPitches = overview.press.funnel.closed;
  const shippedInRange = publishedPerWeek.reduce((sum, n) => sum + n, 0);
  const coverageInRange = coveragePerWeek.reduce((sum, n) => sum + n, 0);
  const attentionShown = attention.slice(0, 8);


  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Overview"}
        description={`Content, SEO, directories and press for ${project.name} at a glance.`}
        actions={<AiSummaryButton />}
      />

      <PageContent>
        <KpiGrid className="sm:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            title="Content published"
            value={published.toLocaleString()}
            delta={{
              label: `+${publishedThisMonth}`,
              direction: publishedThisMonth > 0 ? "up" : "flat",
              favorable: true,
            }}
            comparison="in the last 30 days"
            action={{ label: "Open content", href: `${base}/content` }}
          />
          <KpiCard
            title="Content in progress"
            value={inPipeline.toLocaleString()}
            context={
              scheduledAhead > 0
                ? `${scheduledAhead} scheduled to publish`
                : `${createdInRange.toLocaleString()} created in the last ${WEEKS} weeks`
            }
            action={{ label: "Open content", href: `${base}/content` }}
          />
          <KpiCard
            title="SEO score"
            value={seo ? `${seo.score}` : "–"}
            decimals={seo ? "%" : undefined}
            delta={
              !seo || seo.change === null
                ? undefined
                : {
                    label: `${seo.change > 0 ? "+" : seo.change < 0 ? "−" : ""}${Math.abs(seo.change)} pts`,
                    direction: seo.change > 0 ? "up" : seo.change < 0 ? "down" : "flat",
                    favorable: seo.change >= 0,
                  }
            }
            comparison="since the last check"
            context={seo ? `${seo.host} · checked ${shortDate(seo.checkedAt)}` : "No pages checked yet"}
            action={{ label: "Open the SEO checker", href: `${base}/seo` }}
          />
          <KpiCard
            title="Outlets featured in"
            value={outletsFeatured.toLocaleString()}
            context={
              followUpsDue > 0 ? (
                <span className="font-semibold text-warning">
                  {followUpsDue} press {followUpsDue === 1 ? "follow-up" : "follow-ups"} due
                </span>
              ) : (
                `${piecesOfCoverage.toLocaleString()} ${piecesOfCoverage === 1 ? "piece" : "pieces"} of coverage`
              )
            }
            action={{ label: "Open Press & Media", href: `${base}/media` }}
          />
          <KpiCard
            title="Directories live"
            value={directories.live.toLocaleString()}
            className="col-span-2 sm:col-span-1"
            context={
              directories.needChanges > 0 ? (
                <span className="font-semibold text-warning">
                  {directories.needChanges} {directories.needChanges === 1 ? "needs" : "need"} changes
                </span>
              ) : directories.total > 0 ? (
                `${directories.pending} pending review · ${directories.total} in total`
              ) : (
                "No directories added yet"
              )
            }
            action={{ label: "Open directories", href: `${base}/directories` }}
          />
        </KpiGrid>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Momentum</CardTitle>
              <CardDescription>Content published and new press coverage, last {WEEKS} weeks</CardDescription>
              <CardAction className="flex items-baseline gap-4 text-right">
                <span className="flex flex-col">
                  <span className="text-[22px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{shippedInRange}</span>
                  <span className="mt-1 text-xs text-muted-foreground">published</span>
                </span>
                <span className="flex flex-col">
                  <span className="text-[22px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{coverageInRange}</span>
                  <span className="mt-1 text-xs text-muted-foreground">features</span>
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ChartLegend
                series={[
                  { name: "Content published", color: "chart-1" },
                  { name: "Press coverage", color: "chart-2" },
                ]}
              />
              <GroupedWeeklyBars
                weeks={weeks}
                label={`Content published and press coverage per week over the last ${WEEKS} weeks`}
                series={[
                  { name: "Content published", counts: publishedPerWeek, color: "chart-1" },
                  { name: "Press coverage", counts: coveragePerWeek, color: "chart-2" },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coming up</CardTitle>
              <CardDescription>Publish dates and press follow-ups</CardDescription>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="m-0 py-6 text-center text-[13px] text-muted-foreground">Nothing scheduled yet.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {upcoming.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent leading-none text-accent-foreground">
                        <span className="text-[15px] font-extrabold tabular-nums">{item.date.getUTCDate()}</span>
                        <span className="mt-0.5 text-2xs font-bold uppercase">
                          {item.date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 truncate text-[13px] font-semibold text-foreground">{item.title}</p>
                        <p className="m-0 truncate text-xs text-muted-foreground">{item.meta}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>What&apos;s slipping across content, SEO, directories and press</CardDescription>
              {attention.length > 0 && (
                <CardAction>
                  <Badge variant="warning">
                    {attention.length} {attention.length === 1 ? "item" : "items"}
                  </Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl bg-success-muted/60 px-4 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-muted text-success">
                    <CircleCheckIcon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="m-0 text-sm font-semibold text-foreground">All clear</p>
                    <p className="m-0 text-xs text-muted-foreground">Nothing is overdue or broken right now.</p>
                  </div>
                </div>
              ) : (
                <ul className="m-0 grid list-none gap-2 p-0 xl:grid-cols-2">
                  {attentionShown.map((item) => {
                    const Icon = CHANNEL_ICON[item.channel];
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="group/item flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-3 no-underline transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl",
                              item.tone === "destructive" ? "bg-destructive-muted text-destructive" : "bg-warning-muted text-warning"
                            )}
                          >
                            <Icon className="size-4.5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.channel} · {item.detail}
                            </span>
                          </span>
                          <ArrowUpRightIcon
                            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {attention.length > attentionShown.length && (
                <p className="m-0 mt-3 text-xs text-muted-foreground">
                  Showing the {attentionShown.length} most urgent of {attention.length}.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Press funnel</CardTitle>
              <CardDescription>From target outlet to published feature</CardDescription>
              <CardAction>
                <Button asChild variant="outline" size="icon">
                  <Link href={`${base}/media`} aria-label="Open Press & Media" title="Open Press & Media">
                    <ArrowUpRightIcon aria-hidden="true" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {funnel.map((step) => (
                  <li key={step.stage} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{step.stage}</span>
                        <span className="text-xs text-muted-foreground">{step.hint}</span>
                      </span>
                      <span className="text-[22px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{step.count}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-chart-track" aria-hidden="true">
                      <div
                        className={cn("h-full rounded-full", step.bar, step.count === 0 && "opacity-0")}
                        style={{ width: `${Math.max(4, (step.count / funnelMax) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
              <p className="m-0 border-t border-border pt-3 text-xs text-muted-foreground">
                {closedPitches > 0
                  ? `${closedPitches} ${closedPitches === 1 ? "pitch" : "pitches"} closed (rejected or withdrawn)`
                  : "No pitches have been rejected or withdrawn"}
              </p>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
