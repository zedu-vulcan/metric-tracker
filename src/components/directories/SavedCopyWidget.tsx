"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckIcon, CopyIcon, Edit3Icon, MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/request-json";

export interface SavedCopyBlock {
  id: string;
  label: string;
  text: string;
  position: number;
}

const COPY_FEEDBACK_MS = 1600;
// Roughly three lines of the tile's text at its narrowest width.
const CLAMP_THRESHOLD = 140;

const characters = (text: string) => `${text.length.toLocaleString()} ${text.length === 1 ? "character" : "characters"}`;

export function SavedCopyWidget({
  title = "Saved submission copy",
  helper = "Reusable text so every listing says the same thing.",
  className,
}: {
  title?: string;
  helper?: string;
  className?: string;
}) {
  const [blocks, setBlocks] = useState<SavedCopyBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean } | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<SavedCopyBlock | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formText, setFormText] = useState("");

  const loadBlocks = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await apiFetch("/api/directories/copy", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setBlocks((await response.json()) as SavedCopyBlock[]);
    } catch {
      setLoadError("Couldn't load saved copy.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  useEffect(() => {
    if (feedback === undefined) return;
    const timer = window.setTimeout(() => setFeedback(undefined), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const copyToClipboard = async (block: SavedCopyBlock) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard is not available");
      }
      await navigator.clipboard.writeText(block.text);
      setFeedback({ id: block.id, ok: true });
    } catch {
      setFeedback({ id: block.id, ok: false });
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openAddModal = () => {
    setFormError("");
    setEditingBlock(null);
    setFormLabel("");
    setFormText("");
    setIsModalOpen(true);
  };

  const openEditModal = (block: SavedCopyBlock) => {
    setFormError("");
    setEditingBlock(block);
    setFormLabel(block.label);
    setFormText(block.text);
    setIsModalOpen(true);
  };

  const canSave = formLabel.trim() !== "" && formText.trim() !== "";

  const handleSaveBlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setFormError("");
    try {
      const response = await apiFetch(editingBlock ? `/api/directories/copy/${editingBlock.id}` : "/api/directories/copy", {
        method: editingBlock ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: formLabel.trim(), text: formText.trim() }),
      });
      const body = (await response.json().catch(() => null)) as
        | (SavedCopyBlock & { error?: string; details?: Record<string, string[]> })
        | null;
      if (!response.ok) {
        const detail = body?.details ? Object.values(body.details).flat()[0] : undefined;
        throw new Error(detail ?? body?.error ?? "Couldn't save. Please try again.");
      }
      const saved = body as SavedCopyBlock;
      setBlocks((previous) =>
        editingBlock ? previous.map((block) => (block.id === saved.id ? saved : block)) : [...previous, saved]
      );
      setIsModalOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Couldn't save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBlock = async (block: SavedCopyBlock) => {
    setActionError("");
    setBlocks((previous) => previous.filter((item) => item.id !== block.id));
    try {
      const response = await apiFetch(`/api/directories/copy/${block.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error();
    } catch {
      setBlocks((previous) => [...previous, block].sort((a, b) => a.position - b.position));
      setActionError(`Couldn't delete "${block.label}". Please try again.`);
    }
  };

  return (
    <section
      aria-labelledby="saved-copy-title"
      className={cn("flex min-w-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-4 sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="saved-copy-title" className="m-0 text-[17px] leading-tight font-bold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          <p className="m-0 text-[13px] text-muted-foreground">{helper}</p>
        </div>
        <Button variant="outline" size="sm" onClick={openAddModal} className="shrink-0">
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Add copy
        </Button>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-busy="true" aria-label="Loading saved copy">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadBlocks()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : blocks.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed py-10">
          <EmptyHeader>
            <EmptyTitle>No saved copy yet</EmptyTitle>
            <EmptyDescription>Save your tagline and descriptions here to paste them into any directory.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={openAddModal}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Add copy
          </Button>
        </Empty>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
          {blocks.map((block) => {
            const state = feedback?.id === block.id ? feedback : undefined;
            const isLong = block.text.length > CLAMP_THRESHOLD;
            const isExpanded = expanded.has(block.id);
            return (
              <li key={block.id} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-muted p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <p className="m-0 truncate text-sm font-semibold text-foreground" title={block.label}>
                      {block.label}
                    </p>
                    <p className="m-0 text-xs text-muted-foreground tabular-nums">{characters(block.text)}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      type="button"
                      aria-label={`More actions for ${block.label}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-mt-1 -mr-1 hover:bg-card")}
                    >
                      <MoreHorizontalIcon aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onSelect={() => openEditModal(block)}>
                        <Edit3Icon aria-hidden="true" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => void handleDeleteBlock(block)}>
                        <Trash2Icon aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p
                  className={cn(
                    "m-0 text-sm leading-relaxed break-words whitespace-pre-line text-foreground/85",
                    isLong && !isExpanded && "line-clamp-3"
                  )}
                >
                  {block.text}
                </p>

                <div className="mt-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(block)}
                  >
                    {state?.ok ? (
                      <CheckIcon data-icon="inline-start" aria-hidden="true" className="text-success" />
                    ) : (
                      <CopyIcon data-icon="inline-start" aria-hidden="true" />
                    )}
                    {state?.ok ? (
                      <span className="text-success">Copied</span>
                    ) : state?.ok === false ? (
                      <span className="text-destructive">Couldn&apos;t copy</span>
                    ) : (
                      "Copy"
                    )}
                  </Button>
                  {isLong && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(block.id)}
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="sr-only" aria-live="polite">
        {feedback?.ok ? "Copied to clipboard" : feedback?.ok === false ? "Couldn't copy to clipboard" : ""}
      </p>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          <form onSubmit={(event) => void handleSaveBlock(event)} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
              <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">
                {editingBlock ? "Edit copy" : "Add copy"}
              </DialogTitle>
              <DialogDescription>Save text you paste into directory listings again and again.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              {formError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="copy-label">Label</FieldLabel>
                  <Input
                    id="copy-label"
                    placeholder="e.g. Founder bio, Keywords, Pricing summary"
                    value={formLabel}
                    onChange={(event) => setFormLabel(event.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="copy-text">Text</FieldLabel>
                  <Textarea
                    id="copy-text"
                    rows={6}
                    placeholder="Paste or type the text you reuse in submissions"
                    value={formText}
                    onChange={(event) => setFormText(event.target.value)}
                  />
                  <FieldDescription className="text-xs tabular-nums">{characters(formText)}</FieldDescription>
                </Field>
              </FieldGroup>
            </div>
            <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-2xl">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave || isSaving}>
                {isSaving && <Spinner data-icon="inline-start" />}
                {isSaving ? "Saving…" : editingBlock ? "Save changes" : "Add copy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default SavedCopyWidget;
