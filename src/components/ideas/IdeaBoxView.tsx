"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, FileTextIcon, LightbulbIcon, LinkIcon, SearchXIcon, type LucideIcon } from "lucide-react";
import { timeAgo } from "@/components/profile/NotificationParts";
import { useProject } from "@/components/projects/ProjectProvider";
import { PillSelect, SearchPill, Toolbar } from "@/components/Toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { WorkReader } from "@/components/tasks/DeliveredWork";
import { shortDateTime, taskTypeLabel } from "@/components/tasks/task-model";
import type { Attachment } from "@/components/tasks/thread-model";
import { cn } from "@/lib/utils";

const ALL = "all";
const UNCATEGORIZED = "Uncategorized";

type Deliverable = {
  id: string;
  ref: string;
  title: string;
  taskType: string | null;
  doneBy: string;
  deliveredAt: string;
  attachment: Attachment;
};

function categoryFor(taskType: string | null): string {
  const slug = taskType?.trim();
  return slug ? taskTypeLabel(slug) : UNCATEGORIZED;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The opening of the work as one plain line: markdown syntax stripped, whitespace collapsed. */
function excerpt(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function pieces(count: number) {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? "piece" : "pieces"}`;
}

/** Approved deliverables as a searchable library: find a piece, read or copy it, or jump to its task. */
export function IdeaBoxView({ deliverables }: { deliverables: Deliverable[] }) {
  const { href } = useProject();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [reading, setReading] = useState<Deliverable | null>(null);

  const library = useMemo(
    () =>
      [...deliverables]
        .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt))
        .map((item) => {
          const label = categoryFor(item.taskType);
          const preview = item.attachment.kind === "link" ? hostname(item.attachment.content) : excerpt(item.attachment.content);
          return {
            item,
            category: label,
            preview,
            haystack: [item.title, item.ref, label, item.doneBy, item.attachment.content].join("\n").toLowerCase(),
          };
        }),
    [deliverables]
  );

  const categoryOptions = useMemo(() => {
    const labels = [...new Set(library.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b));
    return [{ value: ALL, label: "All" }, ...labels.map((label) => ({ value: label, label }))];
  }, [library]);

  const activeCategory = categoryOptions.some((option) => option.value === category) ? category : ALL;
  const term = query.trim().toLowerCase();
  const filtering = term !== "" || activeCategory !== ALL;
  const shown = library.filter(
    (entry) => (activeCategory === ALL || entry.category === activeCategory) && (!term || entry.haystack.includes(term))
  );

  const clearFilters = () => {
    setQuery("");
    setCategory(ALL);
  };

  return (
    <>
      {library.length > 0 && (
        <Toolbar className="md:justify-start">
          <SearchPill value={query} onChange={setQuery} placeholder="Search approved work" className="md:w-80" />
          <PillSelect
            label="Category"
            value={activeCategory}
            onChange={setCategory}
            options={categoryOptions}
            className="self-start"
          />
        </Toolbar>
      )}

      <Card className="pb-0">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Approved work
          </CardTitle>
          <CardAction className="self-center text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
            {filtering ? `${shown.length.toLocaleString("en-GB")} of ${pieces(library.length)}` : pieces(library.length)}
          </CardAction>
        </CardHeader>

        {library.length === 0 ? (
          <LibraryEmpty
            icon={LightbulbIcon}
            title="Nothing approved yet"
            description="When a task's delivery is approved, the work lands here so anyone in the project can find and reuse it."
          >
            <Button variant="secondary" asChild>
              <Link href={href("/tasks")}>Go to tasks</Link>
            </Button>
          </LibraryEmpty>
        ) : shown.length === 0 ? (
          <LibraryEmpty
            icon={SearchXIcon}
            title="No work matches"
            description={
              term
                ? `Nothing${activeCategory === ALL ? "" : ` in ${activeCategory}`} mentions “${query.trim()}”.`
                : `Nothing approved in ${activeCategory} yet.`
            }
          >
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </LibraryEmpty>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-border border-t border-border p-0">
            {shown.map(({ item, category: label, preview }) => (
              <LibraryRow
                key={item.id}
                item={item}
                category={label}
                preview={preview}
                taskHref={href(`/tasks/${encodeURIComponent(item.id)}`)}
                onRead={() => setReading(item)}
              />
            ))}
          </ul>
        )}
      </Card>

      {reading && (
        <WorkReader
          attachment={reading.attachment}
          title={reading.title}
          from={`${reading.ref} · Done by ${reading.doneBy} · ${shortDateTime.format(new Date(reading.deliveredAt))}`}
          open
          onOpenChange={(open) => !open && setReading(null)}
        />
      )}
    </>
  );
}

// The title is the row's main control; its ::after stretches over the whole row so the row reads as one target.
const ROW_TARGET =
  "min-w-0 truncate text-left text-[15px] leading-snug font-semibold text-foreground no-underline outline-none transition-colors group-hover/row:text-primary-deep after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset";

function LibraryRow({
  item,
  category,
  preview,
  taskHref,
  onRead,
}: {
  item: Deliverable;
  category: string;
  preview: string;
  taskHref: string;
  onRead: () => void;
}) {
  const link = item.attachment.kind === "link";
  const Icon = link ? LinkIcon : FileTextIcon;

  return (
    <li className="group/row relative flex items-start gap-3.5 px-4 py-4 transition-colors duration-150 hover:bg-accent/45 sm:gap-4 sm:px-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-deep">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          {link ? (
            <a href={item.attachment.content} target="_blank" rel="noopener noreferrer" className={ROW_TARGET}>
              {item.title}
              <span className="sr-only"> (opens the link in a new tab)</span>
            </a>
          ) : (
            <button type="button" onClick={onRead} aria-haspopup="dialog" className={ROW_TARGET}>
              {item.title}
            </button>
          )}
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.ref}</span>
        </div>

        {preview && (
          <p className={cn("m-0 text-sm text-muted-foreground", link ? "truncate" : "line-clamp-2")}>
            {preview}
          </p>
        )}

        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{category}</span>
          <span aria-hidden="true">·</span>
          <span>{item.doneBy}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.deliveredAt} title={shortDateTime.format(new Date(item.deliveredAt))}>
            {timeAgo(item.deliveredAt)}
          </time>
        </p>
      </div>

      <Button variant="ghost" size="icon-sm" asChild className="relative z-10 shrink-0 self-center">
        <Link href={taskHref} aria-label={`Open task ${item.ref}`} title="Open the task">
          <ArrowUpRightIcon aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

function LibraryEmpty({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Empty className="min-h-64 rounded-none border-0 border-t border-solid border-border px-5 py-12">
      <EmptyHeader className="max-w-md">
        <EmptyMedia className="mb-1 size-12 rounded-full bg-accent text-primary-deep">
          <Icon className="size-5" aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="text-[15px] font-bold text-foreground">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{children}</EmptyContent>
    </Empty>
  );
}
