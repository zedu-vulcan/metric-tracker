"use client";

import { useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LinkIcon,
  MessagesSquareIcon,
  PackageCheckIcon,
  ReplyIcon,
  SendIcon,
  StarIcon,
  StickyNoteIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { shortDateTime, type Agent, type Task } from "./task-model";
import { AgentFace, ColorTab, type ItemStyle } from "./TaskParts";
import { useTasks } from "./TasksProvider";
import {
  COMMENT_TYPES,
  REVIEW_SCALE,
  THREAD_FILTERS,
  type Attachment,
  type CommentType,
  type ThreadComment,
} from "./thread-model";

type Filter = "all" | CommentType;

/** Everything in the thread except bids, which have their own tab. */
export function threadMessages(comments: ThreadComment[]): ThreadComment[] {
  return comments.filter((comment) => comment.type !== "bid");
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

/** Top-level messages with their replies; a reply whose parent isn't shown here (a bid) stands on its own. */
function groupReplies(messages: ThreadComment[]) {
  const ids = new Set(messages.map((message) => message.id));
  const replies = new Map<string, ThreadComment[]>();
  const topLevel: ThreadComment[] = [];
  for (const message of messages) {
    if (message.parentId && ids.has(message.parentId)) {
      replies.set(message.parentId, [...(replies.get(message.parentId) ?? []), message]);
    } else {
      topLevel.push(message);
    }
  }
  return { topLevel, replies };
}

/** The conversation about the task, newest last, filterable by message type, with a reply box for people. */
export function TaskThread({ task }: { task: Task }) {
  const { threadFor, agentFor } = useTasks();
  const all = threadFor(task.id);
  const messages = useMemo(() => threadMessages(all), [all]);
  const { topLevel, replies } = useMemo(() => groupReplies(messages), [messages]);
  const [filter, setFilter] = useState<Filter>("all");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const counts = new Map<CommentType, number>();
  for (const message of topLevel) counts.set(message.type, (counts.get(message.type) ?? 0) + 1);
  const filters: Filter[] = ["all", ...THREAD_FILTERS.filter((type) => (counts.get(type) ?? 0) > 0)];
  const visible = filter === "all" ? topLevel : topLevel.filter((message) => message.type === filter);
  const agentOf = (message: ThreadComment) =>
    message.author.kind === "agent" ? agentFor(message.author.agentId) : undefined;

  return (
    <section className="flex flex-col gap-5 rounded-[22px] border border-border bg-card p-5 sm:p-6" aria-label="Thread">
      {messages.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">
          No messages yet. Once an agent takes the task, its delivery, reviews and questions show up here.
        </p>
      ) : (
        <>
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
                      count={value === "all" ? topLevel.length : (counts.get(value) ?? 0)}
                      highlight={value === "escalation"}
                    />
                  ))}
                </TabsList>
              </Tabs>
            )}
            <p className="m-0 ml-auto text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
              {filter === "all"
                ? `${messages.length} ${messages.length === 1 ? "message" : "messages"}`
                : `${visible.length} of ${topLevel.length} messages`}
            </p>
          </div>

          <ol className="relative m-0 flex list-none flex-col gap-6 p-0 before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px before:bg-border">
            {visible.map((message) => {
              const answers = replies.get(message.id) ?? [];
              const replying = replyingTo === message.id;
              return (
                <Message
                  key={message.id}
                  message={message}
                  agent={agentOf(message)}
                  onReply={() => setReplyingTo(replying ? null : message.id)}
                >
                  {(answers.length > 0 || replying) && (
                    <ol className="m-0 mt-1 flex list-none flex-col gap-4 p-0" aria-label={`Replies to ${COMMENT_TYPES[message.type].label.toLowerCase()}`}>
                      {answers.map((answer) => (
                        <Message key={answer.id} message={answer} agent={agentOf(answer)} reply />
                      ))}
                      {replying && (
                        <li>
                          <ReplyBox taskId={task.id} parentId={message.id} onDone={() => setReplyingTo(null)} />
                        </li>
                      )}
                    </ol>
                  )}
                </Message>
              );
            })}
          </ol>
        </>
      )}

      <ReplyBox taskId={task.id} />
    </section>
  );
}

/**
 * People answer escalations and add context with notes; agents read them in the thread and their inbox.
 * With a `parentId` it answers one message, inline under it.
 */
function ReplyBox({ taskId, parentId, onDone }: { taskId: string; parentId?: string; onDone?: () => void }) {
  const { postNote } = useTasks();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `reply-${parentId ?? taskId}`;

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await postNote(taskId, text, parentId);
      setBody("");
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't post your reply. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={send} className={cn("flex flex-col gap-3", !parentId && "border-t border-border pt-5")}>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id} className={cn(parentId && "sr-only")}>Reply</FieldLabel>
        <Textarea
          id={id}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Answer a question, share access details or add context for the agents."
          rows={parentId ? 2 : 3}
          autoFocus={Boolean(parentId)}
          maxLength={10000}
          aria-invalid={error ? true : undefined}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" size={parentId ? "sm" : "default"} onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="secondary" size={parentId ? "sm" : "default"} disabled={sending || !body.trim()}>
          {sending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" aria-hidden="true" />}
          Post reply
        </Button>
      </div>
    </form>
  );
}

function Message({
  message,
  agent,
  reply = false,
  onReply,
  children,
}: {
  message: ThreadComment;
  agent?: Agent;
  /** Shown smaller, under the message it answers. */
  reply?: boolean;
  onReply?: () => void;
  children?: React.ReactNode;
}) {
  const type = COMMENT_TYPES[message.type];
  const person = message.author.kind === "human";
  const name = message.author.kind === "human" ? message.author.name : (agent?.name ?? "Unknown agent");

  return (
    <li className={cn("flex", reply ? "gap-2.5" : "gap-3 sm:gap-4")}>
      <AgentFace
        name={name}
        agent={agent}
        person={person}
        className={cn("relative ring-4 ring-card", reply ? "size-8 text-xs" : "size-10 text-[13px]")}
      />

      <article
        className="flex min-w-0 flex-1 flex-col gap-2"
        aria-label={reply ? `Reply from ${name}` : `${type.label} from ${name}`}
      >
        <header className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", reply ? "pt-1.5" : "pt-2")}>
          <span className="text-sm font-bold text-foreground">{name}</span>
          {person ? (
            <span className="text-xs text-muted-foreground">Team</span>
          ) : (
            agent && (
              <span className="text-xs text-muted-foreground">
                {agent.speciality} · {agent.ownerName}
              </span>
            )
          )}
          <time dateTime={message.at} className="ml-auto text-xs text-muted-foreground tabular-nums">
            {shortDateTime.format(new Date(message.at))}
          </time>
        </header>

        <div
          className={cn(
            "flex flex-col gap-2.5 rounded-2xl rounded-tl-md",
            reply ? "px-3.5 py-2.5" : "px-4 py-3.5 sm:px-5 sm:py-4",
            MESSAGE_STYLES[message.type]?.bubble ?? "bg-muted"
          )}
        >
          {!reply && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <Badge variant={type.badge}>{type.label}</Badge>
              {message.verdict && (
                <Badge variant={message.verdict === "approve" ? "success" : "warning"}>
                  {message.verdict === "approve" ? "Approves" : "Asks for changes"}
                </Badge>
              )}
              {message.title && <h3 className="m-0 text-[15px] leading-snug font-bold text-foreground">{message.title}</h3>}
              {message.score !== undefined && <Score value={message.score} />}
            </div>
          )}
          {person ? (
            <p className="m-0 max-w-[72ch] text-sm leading-relaxed whitespace-pre-line text-foreground/85">{message.body}</p>
          ) : (
            <Markdown className="max-w-[72ch] text-sm leading-relaxed text-foreground/85">{message.body}</Markdown>
          )}
          {message.attachment && (
            <AttachmentFile
              attachment={message.attachment}
              from={`${name} · ${shortDateTime.format(new Date(message.at))}`}
            />
          )}
        </div>

        {onReply && (
          <Button variant="ghost" size="xs" className="self-start" onClick={onReply}>
            <ReplyIcon data-icon="inline-start" aria-hidden="true" />
            Reply
          </Button>
        )}
        {children}
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

function wordCount(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${words.toLocaleString("en-GB")} ${words === 1 ? "word" : "words"}`;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const FILE_TILE =
  "group/file mt-1 flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-card p-2.5 pr-3.5 text-left text-inherit no-underline transition-colors duration-150 outline-none hover:border-border-strong hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * The deliverable as a file: the thread stays short, and the work opens in its own window to read or copy.
 * A link opens in a new tab instead.
 */
function AttachmentFile({ attachment, from }: { attachment: Attachment; from: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = attachment.kind === "link";
  const Icon = link ? LinkIcon : FileTextIcon;

  const tile = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-deep">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground transition-colors group-hover/file:text-primary-deep">
          {attachment.label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {link ? hostname(attachment.content) : `${wordCount(attachment.content)} · click to open`}
        </span>
      </span>
      {link ? (
        <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <ChevronRightIcon
          className="size-4 shrink-0 text-muted-foreground transition-[color,translate] duration-150 group-hover/file:translate-x-0.5 group-hover/file:text-primary-deep"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (link) {
    return (
      <a href={attachment.content} target="_blank" rel="noopener noreferrer" className={FILE_TILE}>
        {tile}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

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
    <>
      <button type="button" onClick={() => setOpen(true)} className={FILE_TILE} aria-haspopup="dialog">
        {tile}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 flex-row items-center gap-3 border-b border-border px-6 py-5 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-deep">
              <FileTextIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="text-lg font-extrabold tracking-[-0.02em]">{attachment.label}</DialogTitle>
              <DialogDescription className="truncate">
                {from} · {wordCount(attachment.content)}
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <Markdown className="max-w-[75ch] text-[15px] leading-relaxed text-foreground">{attachment.content}</Markdown>
          </div>
          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? (
                <CheckIcon data-icon="inline-start" aria-hidden="true" />
              ) : (
                <CopyIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy the work"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
