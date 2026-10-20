"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CheckIcon,
  CircleDotIcon,
  CopyIcon,
  FileIcon,
  FileTextIcon,
  LinkIcon,
  MessageSquareIcon,
  UserCheckIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { shortDateTime, type Agent, type Task } from "./goal-model";
import { Panel, QuietEmpty } from "./GoalParts";
import { useGoals } from "./GoalsProvider";
import {
  ACTIVE_STATUSES,
  COMMENT_TYPES,
  MAX_ACTIVE_TASKS,
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
    <Panel
      title="Thread"
      count={total}
      action={<span className="text-xs text-muted-foreground">Agents bid, deliver and review here</span>}
    >
      {entries.length === 0 ? (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep">
              <MessageSquareIcon className="size-5" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No activity yet</EmptyTitle>
            <EmptyDescription>Bids from interested agents will show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="pt-1">
          <TabsList className="max-w-full justify-start overflow-x-auto" aria-label="Filter the thread by comment type">
            {filters.map((value) => (
              <TabsTrigger key={value} value={value} className="flex-none">
                {value === "all" ? "All" : COMMENT_TYPES[value].plural}{" "}
                <span className="tabular-nums opacity-70">{value === "all" ? total : counts.get(value)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {filters.map((value) => {
            const visible =
              value === "all" ? entries : entries.filter((entry) => entry.kind === "comment" && entry.type === value);
            return (
              <TabsContent key={value} value={value}>
                {visible.length === 0 ? (
                  <QuietEmpty>Nothing here yet.</QuietEmpty>
                ) : (
                  <ol className="m-0 flex list-none flex-col divide-y divide-border p-0">
                    {visible.map((entry) => (
                      <ThreadItem key={entry.id} entry={entry} task={task} />
                    ))}
                  </ol>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <NoteComposer taskId={task.id} onPost={(body) => addNote(task.id, body)} />
    </Panel>
  );
}

function ThreadItem({ entry, task }: { entry: ThreadEntry; task: Task }) {
  if (entry.kind === "event") {
    return (
      <li className="flex items-center gap-2 py-2.5 text-xs text-muted-foreground">
        <CircleDotIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{entry.text}</span>
        <EntryTime at={entry.at} />
      </li>
    );
  }
  return <CommentItem comment={entry} task={task} />;
}

function CommentItem({ comment, task }: { comment: ThreadComment; task: Task }) {
  const { agentFor, currentUser } = useGoals();
  const author = describeAuthor(comment.author, agentFor, currentUser.name);
  const type = COMMENT_TYPES[comment.type];
  const bidder = comment.type === "bid" && comment.author.kind === "agent" ? agentFor(comment.author.agentId) : undefined;

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

/** Lets a human assign the task to this bidder, showing how busy the bidder already is. */
function BidActions({ bidder, task }: { bidder: Agent; task: Task }) {
  const { tasks, assignTask } = useGoals();
  const [confirming, setConfirming] = useState(false);

  const biddingOpen = task.status === "open" || task.status === "bidding";
  const assigned = task.assignedAgentId === bidder.id;
  if (!biddingOpen && !assigned) return null;

  const activeTasks = tasks.filter(
    (candidate) => candidate.assignedAgentId === bidder.id && ACTIVE_STATUSES.includes(candidate.status)
  ).length;
  const atLimit = activeTasks >= MAX_ACTIVE_TASKS;
  const otherBidders = Math.max(task.bidCount - 1, 0);

  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        {activeTasks} of {MAX_ACTIVE_TASKS} active tasks
      </span>

      {assigned ? (
        <Badge variant="success">
          <CheckIcon data-icon="inline-start" aria-hidden="true" />
          Assigned
        </Badge>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={atLimit}
          onClick={() => setConfirming(true)}
          aria-label={atLimit ? `${bidder.name} is at the active-task limit` : `Assign this task to ${bidder.name}`}
        >
          <UserCheckIcon data-icon="inline-start" aria-hidden="true" />
          {atLimit ? "At task limit" : `Assign to ${bidder.name}`}
        </Button>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Assign to {bidder.name}?</DialogTitle>
            <DialogDescription>
              {bidder.name} ({bidder.ownerName}) gets the offer and starts work on &ldquo;{task.title}&rdquo;.
              {otherBidders > 0 &&
                ` The other ${otherBidders} ${otherBidders === 1 ? "bidder stays" : "bidders stay"} in the thread but won't be assigned.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                assignTask(task.id, bidder.id);
                setConfirming(false);
              }}
            >
              Assign task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
