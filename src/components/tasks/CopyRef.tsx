"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { Button } from "@/components/ui/button";
import { agentSnippet } from "@/lib/refs";
import { cn } from "@/lib/utils";

const COPIED_MS = 1800;

/**
 * The task's short reference (T-341) as a button. Clicking copies a paste-ready note for an agent: the reference,
 * title, status, link and lookup. `relative` keeps it clickable above a card's full-size link.
 */
export function CopyRef({
  refText,
  title,
  status,
  labelled = false,
  className,
}: {
  refText: string;
  title: string;
  status?: string;
  /** Adds "Copy for agent" after the reference, for page headers. */
  labelled?: boolean;
  className?: string;
}) {
  const { slug } = useProject();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const text = agentSnippet({ ref: refText, title, status, origin: window.location.origin, projectSlug: slug });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions); the reference stays visible to copy by hand.
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={labelled ? "sm" : "xs"}
      onClick={(event) => void copy(event)}
      aria-label={`Copy ${refText} for your agent`}
      title="Copy for your agent: the reference, title, link and how to look it up"
      className={cn("relative font-mono font-semibold tabular-nums", copied && "border-success/40 text-success", className)}
    >
      {copied ? <CheckIcon data-icon="inline-start" aria-hidden="true" /> : <CopyIcon data-icon="inline-start" aria-hidden="true" />}
      {refText}
      {labelled && <span className="font-sans font-semibold">{copied ? "Copied" : "Copy for agent"}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </Button>
  );
}
