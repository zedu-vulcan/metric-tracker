"use client";

import { Fragment, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { RotateCwIcon, Settings2Icon } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { PageContent, PageHeader } from "@/components/PageHeader";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProject } from "@/components/projects/ProjectProvider";
import { CATEGORY_LABELS, CATEGORY_ORDER, IMPORTANCE_LABEL, scoreLabel } from "@/lib/seo/config";
import { todoList } from "@/lib/seo/scoring";
import type { CategoryId, Outcome, Severity } from "@/lib/seo/types";
import { cn } from "@/lib/utils";
import { openCheck, runCheck, saveSeoSettings, type ActionResult } from "./actions";
import type { SeoView } from "./data";

// A saved check younger than this is shown as-is on load instead of running a new one.
const FRESH_FOR_MS = 10 * 60_000;

const card = "flex min-w-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-4 sm:p-5";
const cardTitle = "m-0 text-[17px] leading-tight font-bold tracking-[-0.02em] text-foreground";
const hint = "m-0 text-[13px] text-muted-foreground";

const TONE = { ok: "text-success", warn: "text-warning", err: "text-destructive", tip: "text-primary-deep" };

const OUTCOME: Record<Outcome, { text: string; cls: string }> = {
  pass: { text: "✓ Pass", cls: TONE.ok },
  warn: { text: "▲ Needs work", cls: TONE.warn },
  fail: { text: "✕ Fail", cls: TONE.err },
};
const SEVERITY: Record<Severity, { text: string; cls: string }> = {
  error: { text: "✕ Error", cls: TONE.err },
  warning: { text: "▲ Warning", cls: TONE.warn },
  tip: { text: "● Tip", cls: TONE.tip },
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function checkedAgo(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relative.format(minutes, "minute");
  if (minutes > -1440) return relative.format(Math.round(minutes / 60), "hour");
  return `on ${date(iso)}`;
}

function hostOf(url: string) {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).host;
  } catch {
    return url;
  }
}

export function SeoChecker({ initial, initialUrl }: { initial: SeoView | null; initialUrl: string }) {
  const project = useProject();
  const [view, setView] = useState<SeoView | null>(initial);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<CategoryId>("meta");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const [pending, start] = useTransition();
  const startedRef = useRef(false);

  function apply(r: ActionResult, done: string) {
    if (r.ok) {
      setView(r.view);
      setError(null);
      setOpen(new Set());
      setStatus(done);
    } else {
      setError(r.error);
      setStatus("");
    }
  }

  function check(target: string) {
    setStatus(`Checking ${hostOf(target)}…`);
    setError(null);
    start(async () => apply(await runCheck(project.id, { url: target }), "Check complete."));
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const target = initialUrl;
    const sameUrl = initial && hostOf(initial.check.url) === hostOf(target);
    const fresh = sameUrl && Date.now() - new Date(initial.check.createdAt).getTime() < FRESH_FOR_MS;
    if (!sameUrl) setView(null);
    if (!fresh) check(target);
  }, [initial, initialUrl]);

  function openSettings() {
    setDraftUrl(url);
    setSettingsOpen(true);
  }

  function saveSettings(event: FormEvent) {
    event.preventDefault();
    const next = draftUrl.trim();
    if (!next) return;
    start(async () => {
      const saved = await saveSeoSettings(project.id, { url: next });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      setUrl(saved.url);
      setSettingsOpen(false);
      if (view && hostOf(view.check.url) !== hostOf(saved.url)) setView(null);
      setStatus(`Checking ${hostOf(saved.url)}…`);
      apply(await runCheck(project.id, { url: saved.url }), "Settings saved and check complete.");
    });
  }

  function toggle(id: string) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const c = view?.check;
  const todo = c ? todoList(c.results) : [];
  const rows = c ? c.results.filter((r) => r.category === filter) : [];
  const delta = c && view?.previous ? c.score - view.previous.score : null;
  const firstLoad = !c && pending;

  return (
    <>
      <PageHeader
        title="SEO checker"
        description="How well a page is set up for search engines. Only the page's HTML is read, so content added by JavaScript isn't seen."
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label="Run the check again"
              title="Run again"
              disabled={pending}
              onClick={() => check(url)}
            >
              {pending ? <Spinner aria-hidden="true" /> : <RotateCwIcon aria-hidden="true" />}
            </Button>
            <Button variant="outline" size="icon" aria-label="Checker settings" title="Settings" onClick={openSettings}>
              <Settings2Icon aria-hidden="true" />
            </Button>
          </>
        }
      />

      <PageContent>
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <span className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={openSettings}>
                  Change page
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => check(url)}>
                  Try again
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        )}

        {firstLoad && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]" aria-hidden="true">
            <div className={card}>
              <Skeleton className="h-5 w-40" />
              <div className="flex flex-wrap items-center gap-8">
                <Skeleton className="size-36 rounded-full" />
                <div className="flex min-w-[240px] flex-1 flex-col gap-3">
                  {CATEGORY_ORDER.map((k) => (
                    <Skeleton key={k} className="h-3 w-full" />
                  ))}
                </div>
              </div>
            </div>
            <div className={card}>
              <Skeleton className="h-5 w-32" />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        )}

        {!c && !firstLoad && !error && (
          <Empty className="rounded-[22px] border">
            <EmptyHeader>
              <EmptyTitle>No check yet</EmptyTitle>
              <EmptyDescription>Choose the page to check in settings, and the result will show here.</EmptyDescription>
            </EmptyHeader>
            <Button onClick={openSettings}>
              <Settings2Icon data-icon="inline-start" aria-hidden="true" />
              Choose a page
            </Button>
          </Empty>
        )}

        {c && view && (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <section className={card} aria-labelledby="score-h">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 id="score-h" className={cardTitle}>
                      On-page score
                    </h2>
                    <p className={cn(hint, "truncate")}>
                      <span className="font-semibold text-foreground">{hostOf(c.url)}</span> · checked {checkedAgo(c.createdAt)} ·{" "}
                      {c.errorCount} {c.errorCount === 1 ? "error" : "errors"}
                    </p>
                  </div>
                  {pending && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      <Spinner aria-hidden="true" className="size-3.5" />
                      Checking…
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
                  <div
                    className="flex size-36 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `conic-gradient(var(--primary) 0 ${c.score}%, var(--chart-track) 0)` }}
                  >
                    <div className="flex size-28 flex-col items-center justify-center rounded-full bg-card">
                      <span className="text-[32px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{c.score}%</span>
                      <span className={cn("mt-1 text-xs font-semibold", c.score >= 80 ? TONE.ok : c.score >= 50 ? TONE.warn : TONE.err)}>
                        {scoreLabel(c.score)}
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-[240px] flex-1 flex-col gap-3 text-sm">
                    {delta !== null && view.previous && (
                      <p className={cn("m-0 text-xs font-semibold", delta > 0 ? TONE.ok : delta < 0 ? TONE.err : "text-muted-foreground")}>
                        {delta > 0 ? `▲ ${delta} points` : delta < 0 ? `▼ ${-delta} points` : "No change"} since the check on{" "}
                        {date(view.previous.createdAt)}
                      </p>
                    )}
                    {CATEGORY_ORDER.map((k) => (
                      <div key={k} className="grid grid-cols-[110px_1fr_44px] items-center gap-3">
                        <span className="text-muted-foreground">{CATEGORY_LABELS[k]}</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-chart-track" aria-hidden="true">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${c.categoryScores[k] ?? 0}%` }} />
                        </div>
                        <span className="text-right font-semibold tabular-nums">
                          {c.categoryScores[k] === null ? "–" : `${c.categoryScores[k]}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className={card} aria-labelledby="hist-h">
                <div className="flex flex-col gap-1">
                  <h2 id="hist-h" className={cardTitle}>
                    Score history
                  </h2>
                  <p className={hint}>Saved checks of this page</p>
                </div>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {view.history.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        aria-current={h.id === c.id ? "true" : undefined}
                        onClick={() => start(async () => apply(await openCheck(project.id, h.id), `Showing the check from ${date(h.createdAt)}.`))}
                        className="grid min-h-10 w-full cursor-pointer grid-cols-[56px_1fr_44px] items-center gap-3 rounded-xl px-2.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-accent"
                      >
                        <span className="text-muted-foreground">{date(h.createdAt)}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-chart-track" aria-hidden="true">
                          <span className="block h-full rounded-full bg-chart-2" style={{ width: `${h.score}%` }} />
                        </span>
                        <span className="text-right font-semibold tabular-nums">{h.score}%</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <KpiGrid>
              <KpiCard
                title="Response time"
                value={(c.snapshot.responseTimeMs / 1000).toFixed(2)}
                decimals=" sec"
                context={`Status code ${c.snapshot.statusCode}`}
              />
              <KpiCard
                title="Page size"
                value={Math.round(c.snapshot.sizeBytes / 1000).toLocaleString()}
                decimals=" kB"
                context="HTML only"
              />
              <KpiCard title="Word count" value={c.snapshot.wordCount.toLocaleString()} context="Visible text on the page" />
              <KpiCard
                title="Links"
                value={(c.snapshot.internalLinks + c.snapshot.externalLinks).toLocaleString()}
                context={`${c.snapshot.internalLinks} internal · ${c.snapshot.externalLinks} external`}
              />
            </KpiGrid>

            <section className={card} aria-labelledby="snap-h">
              <h2 id="snap-h" className={cardTitle}>
                Page details
              </h2>
              <dl className="m-0 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Meta title", c.snapshot.title ?? "None found"],
                  ["Meta description", c.snapshot.description ?? "None found"],
                  ["Final URL", c.snapshot.finalUrl],
                  ["Indexable", c.snapshot.indexable ? "Yes" : "No"],
                  ["Language", c.snapshot.language ?? "Not set"],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0 rounded-2xl bg-muted px-4 py-3">
                    <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                    <dd className="m-0 mt-1 text-sm font-semibold break-words text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={card} aria-labelledby="todo-h">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="todo-h" className={cardTitle}>
                  To-do list
                </h2>
                <p className={hint}>Sorted by priority</p>
              </div>
              {todo.length === 0 ? (
                <p className={cn("m-0 text-sm font-semibold", TONE.ok)}>✓ Nothing to fix. Every check passed.</p>
              ) : (
                <Table variant="pill">
                  <TableHeader>
                    <TableRow>
                      <TableHead>To do</TableHead>
                      <TableHead className="hidden sm:table-cell">Importance</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Details</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todo.map((t) => (
                      <Fragment key={t.id}>
                        <TableRow>
                          <TableCell className="whitespace-normal">
                            {t.label}
                            <span className={cn("mt-0.5 block text-xs font-semibold sm:hidden", SEVERITY[t.severity].cls)}>
                              {SEVERITY[t.severity].text}
                            </span>
                          </TableCell>
                          <TableCell className={cn("hidden text-xs font-semibold sm:table-cell", SEVERITY[t.severity].cls)}>
                            {SEVERITY[t.severity].text}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-expanded={open.has(t.id)}
                              aria-controls={`todo-${t.id}`}
                              onClick={() => toggle(t.id)}
                            >
                              {open.has(t.id) ? "Hide" : "How to fix"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {open.has(t.id) && (
                          <TableRow id={`todo-${t.id}`} className="hover:bg-transparent">
                            <TableCell colSpan={3} className="h-auto! py-3! whitespace-normal">
                              <div className="flex flex-col gap-1.5 rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed">
                                <p className="m-0">
                                  <span className="font-semibold">What we found:</span> {t.detail}
                                </p>
                                <p className="m-0">
                                  <span className="font-semibold">How to fix it:</span> {t.fix}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className={card} aria-labelledby="checks-h">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="checks-h" className={cardTitle}>
                  Detailed checks
                </h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter checks by area">
                  {CATEGORY_ORDER.map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant={filter === k ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={filter === k}
                      onClick={() => setFilter(k)}
                    >
                      {CATEGORY_LABELS[k]}
                    </Button>
                  ))}
                </div>
              </div>
              <Table variant="pill">
                <TableHeader>
                  <TableRow>
                    <TableHead>Check</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="hidden md:table-cell">Importance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="h-auto! py-3! align-top whitespace-normal">
                        <span className="font-semibold text-foreground">{r.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{r.detail}</span>
                      </TableCell>
                      <TableCell className={cn("py-3! align-top text-xs font-semibold whitespace-nowrap", OUTCOME[r.outcome].cls)}>
                        {OUTCOME[r.outcome].text}
                      </TableCell>
                      <TableCell className="hidden py-3! align-top text-muted-foreground md:table-cell">
                        {IMPORTANCE_LABEL[r.severity]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </>
        )}

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="sm:max-w-[460px]">
            <form onSubmit={saveSettings} className="flex flex-col gap-5">
              <DialogHeader className="gap-1">
                <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Checker settings</DialogTitle>
                <DialogDescription>The page checked each time you open the SEO checker.</DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="seo-url">Page address</FieldLabel>
                <Input
                  id="seo-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://zedu.chat"
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  autoFocus
                />
                <FieldDescription className="text-xs">Shared with everyone in this workspace.</FieldDescription>
              </Field>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || !draftUrl.trim()}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Save and check
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageContent>
    </>
  );
}
