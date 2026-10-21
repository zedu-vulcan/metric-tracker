"use client";

import { useState, type FormEvent } from "react";
import { CircleCheckIcon, SendIcon, TargetIcon, XCircleIcon, type LucideIcon } from "lucide-react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ARTICLE_TYPES,
  PITCH_STATUSES,
  sendJson,
  today,
  type ArticleType,
  type PressItem,
  type Stage,
  type SubmissionStatus,
} from "./press-model";

const STAGES: { value: Stage; icon: LucideIcon; hint: string }[] = [
  { value: "Target", icon: TargetIcon, hint: "Want to be featured" },
  { value: "Pitched", icon: SendIcon, hint: "Pitch sent" },
  { value: "Featured", icon: CircleCheckIcon, hint: "Published" },
  { value: "Closed", icon: XCircleIcon, hint: "Didn't happen" },
];

type FormState = {
  stage: Stage;
  outlet: string;
  title: string;
  articleType: ArticleType | "";
  articleTypeOther: string;
  pitchStatus: SubmissionStatus;
  closedStatus: "Rejected" | "Withdrawn";
  dateSubmitted: string;
  followUpDate: string;
  publicationDate: string;
  owner: string;
  url: string;
  draftUrl: string;
  notes: string;
};

function initialState(item: PressItem | null, stage: Stage, outlet: string): FormState {
  return {
    stage: item?.stage === "Featured" ? "Featured" : stage,
    outlet: item?.outlet ?? outlet,
    title: item?.title ?? "",
    articleType: item?.articleType ?? "",
    articleTypeOther: item?.articleTypeOther ?? "",
    pitchStatus: item && item.stage === "Pitched" ? item.status : "Submitted",
    closedStatus: item?.status === "Withdrawn" ? "Withdrawn" : "Rejected",
    dateSubmitted: (stage === "Pitched" && item?.stage !== "Pitched" ? today() : item?.date) ?? today(),
    followUpDate: item?.followUpDate ?? "",
    publicationDate: item?.stage === "Featured" ? item.date ?? "" : today(),
    owner: item?.owner ?? "",
    url: item?.url ?? "",
    draftUrl: item?.draftUrl ?? "",
    notes: item?.notes ?? "",
  };
}

export function PressFormDialog({
  open,
  onOpenChange,
  item,
  startStage = "Target",
  outlet = "",
  knownOutlets = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PressItem | null;
  startStage?: Stage;
  outlet?: string;
  knownOutlets?: string[];
  onSaved: (message: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        {open && (
          <PressForm
            key={`${item?.id ?? "new"}-${startStage}-${outlet}`}
            item={item}
            startStage={startStage}
            outlet={outlet}
            knownOutlets={knownOutlets}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PressForm({
  item,
  startStage,
  outlet,
  knownOutlets,
  onCancel,
  onSaved,
}: {
  item: PressItem | null;
  startStage: Stage;
  outlet: string;
  knownOutlets: string[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(item, startStage, outlet));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isCoverage = item?.stage === "Featured";
  // Coverage can't turn back into a pitch, and a pitch becomes coverage through "Mark as featured".
  const stageOptions = isCoverage
    ? STAGES.filter((stage) => stage.value === "Featured")
    : item
      ? STAGES.filter((stage) => stage.value !== "Featured")
      : STAGES.filter((stage) => stage.value !== "Closed");

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };

  const isFeatured = form.stage === "Featured";
  const showsPitch = form.stage === "Pitched" || form.stage === "Closed";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.outlet.trim()) {
      setError("Add the outlet's name so you can find it later.");
      return;
    }

    const shared = {
      outlet: form.outlet.trim(),
      title: form.title.trim(),
      articleType: form.articleType,
      articleTypeOther: form.articleType === "Other" ? form.articleTypeOther.trim() : "",
      notes: form.notes.trim(),
    };

    setIsSaving(true);
    try {
      if (isFeatured) {
        const body = {
          ...shared,
          recordType: "Press Coverage",
          articleUrl: form.url.trim(),
          publicationDate: form.publicationDate,
        };
        if (item && !item.coverage) {
          // An older pitch marked Published without its own coverage record: keep it as a submission.
          await sendJson(`/api/media/${item.id}`, "PUT", {
            ...body,
            recordType: "Press Submission",
            status: "Published",
            dateSubmitted: item.date ?? "",
            responsiblePerson: item.owner ?? "",
            documentUrl: item.draftUrl ?? "",
          });
        } else {
          await sendJson(item?.coverage ? `/api/media/${item.coverage.id}` : "/api/media", item?.coverage ? "PUT" : "POST", body);
        }
      } else {
        const status: SubmissionStatus =
          form.stage === "Target" ? "Draft" : form.stage === "Closed" ? form.closedStatus : form.pitchStatus;
        const body = {
          ...shared,
          recordType: "Press Submission",
          status,
          dateSubmitted: form.stage === "Target" ? "" : form.dateSubmitted,
          followUpDate: form.stage === "Pitched" ? form.followUpDate : item?.followUpDate ?? "",
          responsiblePerson: form.owner.trim(),
          documentUrl: form.draftUrl.trim(),
          articleUrl: item?.url ?? "",
          linkedCoverageId: item?.submission?.linkedCoverageId,
        };
        await sendJson(item ? `/api/media/${item.id}` : "/api/media", item ? "PUT" : "POST", body);
      }
      onSaved(item ? `${shared.outlet} updated.` : `${shared.outlet} added.`);
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">
          {item ? `Edit ${item.outlet}` : "Add to press"}
        </DialogTitle>
        <DialogDescription>
          {item ? "Update where this stands." : "Start with where it stands. Only the outlet is needed; add the rest when you know it."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
        {stageOptions.length > 1 && (
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2.5 text-[13px] font-semibold text-foreground">Stage</legend>
            <div className={cn("grid gap-2", stageOptions.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
              {stageOptions.map(({ value, icon: Icon, hint }) => (
                <label
                  key={value}
                  className="group/stage flex cursor-pointer flex-col gap-2 rounded-2xl border border-border bg-card p-3 transition-[border-color,background-color] hover:border-border-strong has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input
                    type="radio"
                    name="press-stage"
                    value={value}
                    checked={form.stage === value}
                    onChange={() => update("stage", value)}
                    className="sr-only"
                  />
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-has-checked/stage:bg-primary group-has-checked/stage:text-primary-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] leading-tight font-semibold text-foreground group-has-checked/stage:text-accent-foreground">
                      {value}
                    </span>
                    <span className="hidden text-xs leading-snug text-muted-foreground sm:block">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="press-outlet">Outlet</FieldLabel>
            <Input
              id="press-outlet"
              value={form.outlet}
              onChange={(event) => update("outlet", event.target.value)}
              placeholder="e.g. TechCabal, BBC Africa, Techpoint"
              autoComplete="off"
              list="press-known-outlets"
              autoFocus
            />
            <datalist id="press-known-outlets">
              {knownOutlets.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>

          <Field>
            <FieldLabel htmlFor="press-title">
              {isFeatured ? "Headline" : form.stage === "Target" ? "Story idea" : "Story or pitch title"}
            </FieldLabel>
            <Input
              id="press-title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder={form.stage === "Target" ? "What could we pitch them?" : ""}
              autoComplete="off"
            />
          </Field>

          {form.stage !== "Target" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="press-type">Type</FieldLabel>
                <NativeSelect
                  id="press-type"
                  className="w-full"
                  value={form.articleType}
                  onChange={(event) => update("articleType", event.target.value as ArticleType | "")}
                >
                  <NativeSelectOption value="">Not set</NativeSelectOption>
                  {ARTICLE_TYPES.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {form.articleType === "Other" ? (
                <Field>
                  <FieldLabel htmlFor="press-type-other">Describe the type</FieldLabel>
                  <Input
                    id="press-type-other"
                    value={form.articleTypeOther}
                    onChange={(event) => update("articleTypeOther", event.target.value)}
                    autoComplete="off"
                  />
                </Field>
              ) : form.stage === "Pitched" ? (
                <Field>
                  <FieldLabel htmlFor="press-status">Pitch status</FieldLabel>
                  <NativeSelect
                    id="press-status"
                    className="w-full"
                    value={form.pitchStatus}
                    onChange={(event) => update("pitchStatus", event.target.value as SubmissionStatus)}
                  >
                    {PITCH_STATUSES.map((status) => (
                      <NativeSelectOption key={status} value={status}>
                        {status}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : form.stage === "Closed" ? (
                <Field>
                  <FieldLabel htmlFor="press-closed">Outcome</FieldLabel>
                  <NativeSelect
                    id="press-closed"
                    className="w-full"
                    value={form.closedStatus}
                    onChange={(event) => update("closedStatus", event.target.value as "Rejected" | "Withdrawn")}
                  >
                    <NativeSelectOption value="Rejected">Rejected</NativeSelectOption>
                    <NativeSelectOption value="Withdrawn">Withdrawn</NativeSelectOption>
                  </NativeSelect>
                </Field>
              ) : null}
            </div>
          )}

          {form.stage === "Pitched" && form.articleType === "Other" && (
            <Field>
              <FieldLabel htmlFor="press-status-other">Pitch status</FieldLabel>
              <NativeSelect
                id="press-status-other"
                className="w-full"
                value={form.pitchStatus}
                onChange={(event) => update("pitchStatus", event.target.value as SubmissionStatus)}
              >
                {PITCH_STATUSES.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {status}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          {showsPitch && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="press-sent">Pitch sent on</FieldLabel>
                <Input
                  id="press-sent"
                  type="date"
                  value={form.dateSubmitted}
                  onChange={(event) => update("dateSubmitted", event.target.value)}
                />
              </Field>
              {form.stage === "Pitched" && (
                <Field>
                  <FieldLabel htmlFor="press-follow-up">Follow up on</FieldLabel>
                  <Input
                    id="press-follow-up"
                    type="date"
                    value={form.followUpDate}
                    onChange={(event) => update("followUpDate", event.target.value)}
                  />
                </Field>
              )}
            </div>
          )}

          {isFeatured && (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
              <Field>
                <FieldLabel htmlFor="press-url">Link to the feature</FieldLabel>
                <Input
                  id="press-url"
                  type="url"
                  inputMode="url"
                  value={form.url}
                  onChange={(event) => update("url", event.target.value)}
                  placeholder="https://"
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="press-published">Published on</FieldLabel>
                <Input
                  id="press-published"
                  type="date"
                  value={form.publicationDate}
                  onChange={(event) => update("publicationDate", event.target.value)}
                />
              </Field>
            </div>
          )}

          {!isFeatured && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="press-owner">Owner</FieldLabel>
                <Input
                  id="press-owner"
                  value={form.owner}
                  onChange={(event) => update("owner", event.target.value)}
                  placeholder="Who's handling it"
                  autoComplete="off"
                />
              </Field>
              {form.stage !== "Target" && (
                <Field>
                  <FieldLabel htmlFor="press-draft">Pitch or draft link</FieldLabel>
                  <Input
                    id="press-draft"
                    type="url"
                    inputMode="url"
                    value={form.draftUrl}
                    onChange={(event) => update("draftUrl", event.target.value)}
                    placeholder="https://"
                    autoComplete="off"
                  />
                </Field>
              )}
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="press-notes">{isFeatured ? "Summary" : "Notes"}</FieldLabel>
            <Textarea
              id="press-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder={
                form.stage === "Target"
                  ? "Who to contact, what they cover, why it's a good fit"
                  : isFeatured
                    ? "What the piece says about you"
                    : "Contacts, feedback, next steps"
              }
            />
            {form.stage === "Target" && (
              <FieldDescription className="text-xs">You can add the pitch details once you reach out.</FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-2xl">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Spinner data-icon="inline-start" />}
          {isSaving ? "Saving…" : item ? "Save changes" : "Add"}
        </Button>
      </DialogFooter>
    </form>
  );
}
