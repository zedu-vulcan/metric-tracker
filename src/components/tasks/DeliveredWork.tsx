"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LinkIcon,
} from "lucide-react";
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
import type { Attachment } from "./thread-model";
import { Markdown } from "./Markdown";

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

/** The deliverable as a file: the work opens in its own window to read or copy. */
export function DeliveredWork({ attachment, from }: { attachment: Attachment; from: string }) {
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
