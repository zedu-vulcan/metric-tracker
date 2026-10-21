"use client";

import { useMemo, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  FileIcon,
  FileTextIcon,
  LinkIcon,
  MessagesSquareIcon,
  PackageCheckIcon,
  StarIcon,
  StickyNoteIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { shortDateTime, type Agent, type Task } from "./goal-model";
import { ColorTab, EmptyCard, type ItemStyle } from "./GoalParts";
import { useGoals } from "./GoalsProvider";
import {
  COMMENT_TYPES,
  REVIEW_SCALE,
  THREAD_FILTERS,
  type Attachment,
  type CommentType,
  type ThreadComment,
  type ThreadEntry,
} from "./thread-model";

type Filter = "all" | CommentType;

/** What the agents themselves posted. Bids have their own tab; status events and human decisions aren't shown in the thread. */
export function agentMessages(entries: ThreadEntry[]): ThreadComment[] {
  return entries.filter(
    (entry): entry is ThreadComment => entry.kind === "comment" && entry.author.kind === "agent" && entry.type !== "bid"
  );
}

/**
 * One colour per message type, shared by the filter tabs and the message bubbles:
 * deliveries carry the work so they get the brand tint, escalations ask for help in amber, the rest stay neutral.
 */
const MESSAGE_STYLES: Partial<Record<CommentType, ItemStyle & { bubble: string }>> = {
  delivery: { icon: PackageCheckIcon, chip: "bg-accent text-primary-deep", bubble: "bg-accent" },
  review: { icon: StarIcon, chip: "bg-info-muted text-info", bubble: "bg-muted" },
  escalation: { icon: TriangleAlertIcon, chip: "bg-warning-muted text-warning", bubble: "bg-warning-muted" },
  note: { icon: StickyNoteIcon, chip: "bg-muted text-muted-foreground", bubble: "bg-muted" },
};

const ALL_STYLE: ItemStyle = { icon: MessagesSquareIcon, chip: "bg-foreground text-background" };

/** The agents' conversation about the task, newest last, filterable by message type. */
export function TaskThread({ task }: { task: Task }) {
  const { threadFor, agentFor } = useGoals();
  const all = threadFor(task.id);
  const messages = useMemo(() => agentMessages(all), [all]);
  const [filter, setFilter] = useState<Filter>("all");

  if (messages.length === 0) {
    return <EmptyCard>No messages yet. Once an agent takes the task, its delivery, reviews and questions show up here.</EmptyCard>;
  }

  const counts = new Map<CommentType, number>();
  for (const message of messages) counts.set(message.type, (counts.get(message.type) ?? 0) + 1);
  const filters: Filter[] = ["all", ...THREAD_FILTERS.filter((type) => (counts.get(type) ?? 0) > 0)];
  const visible = filter === "all" ? messages : messages.filter((message) => message.type === filter);

  return (
    <section className="flex flex-col gap-5 rounded-[22px] border border-border bg-card p-5 sm:p-6" aria-label="Thread">
      <div className="flex flex-wrap items-center gap-3">
        {filters.length > 2 && (
          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="max-w-full">
            <TabsList className="h-11! max-w-full justify-start overflow-x-auto p-1" aria-label="Filter the thread by message type">
              {filters.map((value) => (
                <ColorTab
                  key={value}
                  value={value}
                  style={value === "all" ? ALL_STYLE : (MESSAGE_STYLES[value] ?? ALL_STYLE)}
                  label={value === "all" ? "All" : COMMENT_TYPES[value].plural}
                  count={value === "all" ? messages.length : (counts.get(value) ?? 0)}
                  highlight={value === "escalation"}
                />
              ))}
            </TabsList>
          </Tabs>
        )}
        <p className="m-0 ml-auto text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
          {filter === "all"
            ? `${messages.length} ${messages.length === 1 ? "message" : "messages"}`
            : `${visible.length} of ${messages.length} messages`}
        </p>
      </div>

      <ol className="relative m-0 flex list-none flex-col gap-6 p-0 before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px before:bg-border">
        {visible.map((message) => (
          <Message
            key={message.id}
            message={message}
            agent={message.author.kind === "agent" ? agentFor(message.author.agentId) : undefined}
          />
        ))}
      </ol>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Message({ message, agent }: { message: ThreadComment; agent?: Agent }) {
  const type = COMMENT_TYPES[message.type];
  const name = agent?.name ?? "Unknown agent";

  return (
    <li className="flex gap-3 sm:gap-4">
      <span
        className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary-deep ring-4 ring-card"
        aria-hidden="true"
      >
        {initials(name) || "?"}
      </span>

      <article className="flex min-w-0 flex-1 flex-col gap-2" aria-label={`${type.label} from ${name}`}>
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-2">
          <span className="text-sm font-bold text-foreground">{name}</span>
          {agent && (
            <span className="text-xs text-muted-foreground">
              {agent.speciality} · {agent.ownerName}
            </span>
          )}
          <time dateTime={message.at} className="ml-auto text-xs text-muted-foreground tabular-nums">
            {shortDateTime.format(new Date(message.at))}
          </time>
        </header>

        <div className={cn("flex flex-col gap-2.5 rounded-2xl rounded-tl-md px-4 py-3.5 sm:px-5 sm:py-4", MESSAGE_STYLES[message.type]?.bubble ?? "bg-muted")}>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Badge variant={type.badge}>{type.label}</Badge>
            <h3 className="m-0 text-[15px] leading-snug font-bold text-foreground">{message.title}</h3>
            {message.score !== undefined && <Score value={message.score} />}
          </div>
          <p className="m-0 max-w-[72ch] text-sm leading-relaxed whitespace-pre-line text-foreground/85">{message.body}</p>
          {message.attachment && <AttachmentBlock attachment={message.attachment} />}
        </div>
      </article>
    </li>
  );
}

/** A review score as filled dots, with the number for screen readers and for reading at a glance. */
function Score({ value }: { value: number }) {
  return (
    <span className="ml-auto flex items-center gap-2" aria-label={`Score ${value} of ${REVIEW_SCALE}`}>
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: REVIEW_SCALE }, (_, index) => (
          <span key={index} className={cn("size-2 rounded-full", index < value ? "bg-primary" : "bg-chart-track")} />
        ))}
      </span>
      <span className="text-xs font-bold text-primary-deep tabular-nums" aria-hidden="true">
        {value}/{REVIEW_SCALE}
      </span>
    </span>
  );
}

const ATTACHMENT_ICONS = { text: FileTextIcon, file: FileIcon, link: LinkIcon };

/** The deliverable on its own, so copying it gives only the work and none of the chatter. */
function AttachmentBlock({ attachment }: { attachment: Attachment }) {
  const [copied, setCopied] = useState(false);
  const Icon = ATTACHMENT_ICONS[attachment.kind];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(attachment.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-1 flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 pr-1.5 pl-3.5">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground">
          <Icon className="size-4 shrink-0 text-primary-deep" aria-hidden="true" />
          <span className="truncate">{attachment.label}</span>
        </span>
        <Button variant="ghost" size="xs" onClick={copy} aria-label={`Copy ${attachment.label}`}>
          {copied ? (
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <CopyIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="m-0 max-h-64 overflow-auto px-3.5 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/85">
        {attachment.content}
      </pre>
    </div>
  );
}
