"use client";

import { useState, type FormEvent } from "react";
import {
  ArchiveIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  LightbulbIcon,
  PencilLineIcon,
  PlusIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/request-json";

export type ContentStatus = "Idea" | "Draft" | "Scheduled" | "Published" | "Archived";
export type ContentType = "Article" | "Social post" | "Video" | "Newsletter";

export type ContentApiItem = {
  id: string;
  title: string | null;
  url: string | null;
  type: ContentType | null;
  platform: string | null;
  topics: string[];
  status: ContentStatus;
  createdDate: string;
  publishDate: string | null;
  updatedDate: string | null;
  views: number;
  notes: string | null;
};

type FieldKey = "url" | "type" | "platform" | "topics" | "createdDate" | "publishDate" | "updatedDate" | "views" | "notes";

const STAGES: { value: ContentStatus; icon: LucideIcon; hint: string; fields: FieldKey[] }[] = [
  { value: "Idea", icon: LightbulbIcon, hint: "A thought to come back to", fields: ["notes"] },
  {
    value: "Draft",
    icon: PencilLineIcon,
    hint: "Being written or made",
    fields: ["type", "platform", "topics", "url", "createdDate", "notes"],
  },
  {
    value: "Scheduled",
    icon: CalendarClockIcon,
    hint: "Ready, with a date",
    fields: ["type", "platform", "topics", "url", "publishDate", "createdDate", "notes"],
  },
  {
    value: "Published",
    icon: CircleCheckIcon,
    hint: "Live somewhere",
    fields: ["url", "type", "platform", "topics", "publishDate", "updatedDate", "createdDate", "views", "notes"],
  },
  {
    value: "Archived",
    icon: ArchiveIcon,
    hint: "No longer in use",
    fields: ["url", "type", "platform", "topics", "createdDate", "notes"],
  },
];

const CONTENT_TYPES: ContentType[] = ["Article", "Social post", "Video", "Newsletter"];

const PLATFORMS = [
  { value: "website", label: "Own website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

type FormState = {
  status: ContentStatus;
  title: string;
  url: string;
  type: ContentType | "";
  platform: string;
  topics: string[];
  createdDate: string;
  publishDate: string;
  updatedDate: string;
  views: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyForm(status: ContentStatus = "Idea"): FormState {
  return {
    status,
    title: "",
    url: "",
    type: "",
    platform: "",
    topics: [],
    createdDate: today(),
    publishDate: "",
    updatedDate: "",
    views: "0",
    notes: "",
  };
}

function formFromItem(item: ContentApiItem): FormState {
  return {
    status: item.status,
    title: item.title ?? "",
    url: item.url ?? "",
    type: item.type ?? "",
    platform: item.platform ?? "",
    topics: [...item.topics],
    createdDate: item.createdDate,
    publishDate: item.publishDate ?? "",
    updatedDate: item.updatedDate ?? "",
    views: item.views.toString(),
    notes: item.notes ?? "",
  };
}

export function ContentFormDialog({
  open,
  onOpenChange,
  item,
  knownTopics,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentApiItem | null;
  knownTopics: string[];
  onSaved: (saved: ContentApiItem, mode: "created" | "updated") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        {open && (
          <ContentForm
            key={item?.id ?? "new"}
            item={item}
            knownTopics={knownTopics}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContentForm({
  item,
  knownTopics,
  onCancel,
  onSaved,
}: {
  item: ContentApiItem | null;
  knownTopics: string[];
  onCancel: () => void;
  onSaved: (saved: ContentApiItem, mode: "created" | "updated") => void;
}) {
  const isEditing = item !== null;
  const [form, setForm] = useState<FormState>(() => (item ? formFromItem(item) : emptyForm()));
  const [topicInput, setTopicInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string[]>>>({});
  const [lastCreated, setLastCreated] = useState("");

  const stage = STAGES.find((option) => option.value === form.status) ?? STAGES[0];
  const shows = (field: FieldKey) => stage.fields.includes(field);
  const suggestedTopics = knownTopics.filter((topic) => !form.topics.includes(topic)).slice(0, 8);
  const platformOptions =
    form.platform && !PLATFORMS.some((option) => option.value === form.platform)
      ? [...PLATFORMS, { value: form.platform, label: form.platform }]
      : PLATFORMS;

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    setFormError("");
  };

  const addTopic = (value: string) => {
    const topic = value.trim();
    if (!topic) return;
    setForm((previous) =>
      previous.topics.some((existing) => existing.toLocaleLowerCase() === topic.toLocaleLowerCase())
        ? previous
        : { ...previous, topics: [...previous.topics, topic] }
    );
    setTopicInput("");
  };

  const removeTopic = (topic: string) =>
    setForm((previous) => ({ ...previous, topics: previous.topics.filter((existing) => existing !== topic) }));

  const save = async (addAnother: boolean) => {
    const pendingTopic = topicInput.trim();
    const topics =
      pendingTopic && !form.topics.some((topic) => topic.toLocaleLowerCase() === pendingTopic.toLocaleLowerCase())
        ? [...form.topics, pendingTopic]
        : form.topics;

    const payload = {
      status: form.status,
      title: form.title.trim() || null,
      url: form.url.trim() || null,
      type: form.type || null,
      platform: form.platform || null,
      topics,
      ...(form.createdDate && { createdDate: form.createdDate }),
      publishDate: form.publishDate || null,
      updatedDate: form.updatedDate || null,
      views: Number(form.views),
      notes: form.notes.trim() || null,
    };

    setIsSaving(true);
    setFormError("");
    setFieldErrors({});
    try {
      const response = await apiFetch(isEditing ? `/api/content/${item.id}` : "/api/content", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | ContentApiItem
        | { error?: string; details?: Partial<Record<keyof FormState, string[]>> }
        | null;

      if (!response.ok) {
        const details = body && "details" in body ? body.details : undefined;
        if (details && Object.keys(details).length > 0) {
          setFieldErrors(details);
          setFormError("Check the highlighted field and try again.");
        } else {
          setFormError((body && "error" in body && body.error) || "Couldn't save this content. Please try again.");
        }
        return;
      }

      const saved = body as ContentApiItem;
      onSaved(saved, isEditing ? "updated" : "created");
      if (addAnother) {
        setForm(emptyForm(form.status));
        setTopicInput("");
        setLastCreated(saved.title || "Untitled");
      } else {
        onCancel();
      }
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
  };

  const errorFor = (field: keyof FormState) => fieldErrors[field]?.map((message) => ({ message }));

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">
          {isEditing ? "Edit content" : "Add content"}
        </DialogTitle>
        <DialogDescription>
          Pick a stage and fill in only what you know. Everything can be added later.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-1 pb-6">
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 text-[13px] font-semibold text-foreground">Stage</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {STAGES.map(({ value, icon: Icon, hint }) => (
              <label
                key={value}
                className={cn(
                  "group/stage relative flex cursor-pointer flex-col gap-2 rounded-2xl border border-border bg-card p-3 transition-[border-color,background-color,box-shadow] hover:border-border-strong",
                  "has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                )}
              >
                <input
                  type="radio"
                  name="stage"
                  value={value}
                  checked={form.status === value}
                  onChange={() => update("status", value)}
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

        {lastCreated && (
          <Alert>
            <AlertDescription>
              Created &ldquo;{lastCreated}&rdquo;. Add the next one below.
            </AlertDescription>
          </Alert>
        )}
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(fieldErrors.title)}>
            <FieldLabel htmlFor="content-title">Title</FieldLabel>
            <Input
              id="content-title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder={form.status === "Idea" ? "What's the idea?" : "Give it a working title"}
              aria-invalid={Boolean(fieldErrors.title)}
              autoComplete="off"
              autoFocus
            />
            <FieldError errors={errorFor("title")} />
          </Field>

          {(shows("type") || shows("platform")) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {shows("type") && (
                <Field data-invalid={Boolean(fieldErrors.type)}>
                  <FieldLabel htmlFor="content-type">Type</FieldLabel>
                  <NativeSelect
                    id="content-type"
                    className="w-full"
                    value={form.type}
                    onChange={(event) => update("type", event.target.value as ContentType | "")}
                    aria-invalid={Boolean(fieldErrors.type)}
                  >
                    <NativeSelectOption value="">Not set</NativeSelectOption>
                    {CONTENT_TYPES.map((type) => (
                      <NativeSelectOption key={type} value={type}>
                        {type}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError errors={errorFor("type")} />
                </Field>
              )}
              {shows("platform") && (
                <Field data-invalid={Boolean(fieldErrors.platform)}>
                  <FieldLabel htmlFor="content-platform">Platform</FieldLabel>
                  <NativeSelect
                    id="content-platform"
                    className="w-full"
                    value={form.platform}
                    onChange={(event) => update("platform", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.platform)}
                  >
                    <NativeSelectOption value="">Not set</NativeSelectOption>
                    {platformOptions.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError errors={errorFor("platform")} />
                </Field>
              )}
            </div>
          )}

          {shows("url") && (
            <Field data-invalid={Boolean(fieldErrors.url)}>
              <FieldLabel htmlFor="content-url">{form.status === "Draft" ? "Draft link" : "Link"}</FieldLabel>
              <Input
                id="content-url"
                type="url"
                inputMode="url"
                value={form.url}
                onChange={(event) => update("url", event.target.value)}
                placeholder="https://"
                aria-invalid={Boolean(fieldErrors.url)}
                autoComplete="off"
              />
              <FieldError errors={errorFor("url")} />
            </Field>
          )}

          {shows("topics") && (
            <Field data-invalid={Boolean(fieldErrors.topics)}>
              <FieldLabel htmlFor="content-topics">Topics</FieldLabel>
              <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-2 py-1.5 transition-[border-color,box-shadow] hover:border-border-strong has-focus-visible:border-primary has-focus-visible:ring-4 has-focus-visible:ring-primary/12">
                {form.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex h-7 items-center gap-0.5 rounded-full bg-accent pr-0.5 pl-3 text-xs font-semibold text-accent-foreground"
                  >
                    {topic}
                    <button
                      type="button"
                      aria-label={`Remove ${topic}`}
                      onClick={() => removeTopic(topic)}
                      className="flex size-6 items-center justify-center rounded-full outline-none hover:bg-brand-wash-strong focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <XIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  id="content-topics"
                  value={topicInput}
                  onChange={(event) => setTopicInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addTopic(topicInput);
                    } else if (event.key === "Backspace" && !topicInput && form.topics.length > 0) {
                      removeTopic(form.topics[form.topics.length - 1]);
                    }
                  }}
                  placeholder={form.topics.length ? "Add another" : "Type a topic and press Enter"}
                  className="h-7 min-w-36 flex-1 bg-transparent px-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                  autoComplete="off"
                />
              </div>
              {suggestedTopics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Used before:</span>
                  {suggestedTopics.map((topic) => (
                    <Button key={topic} type="button" variant="outline" size="xs" onClick={() => addTopic(topic)}>
                      <PlusIcon data-icon="inline-start" aria-hidden="true" />
                      {topic}
                    </Button>
                  ))}
                </div>
              )}
              <FieldError errors={errorFor("topics")} />
            </Field>
          )}

          {(shows("publishDate") || shows("updatedDate") || shows("createdDate")) && (
            <div className="grid gap-4 sm:grid-cols-3">
              {shows("publishDate") && (
                <Field data-invalid={Boolean(fieldErrors.publishDate)}>
                  <FieldLabel htmlFor="content-publish">
                    {form.status === "Published" ? "Published on" : "Scheduled for"}
                  </FieldLabel>
                  <Input
                    id="content-publish"
                    type="date"
                    value={form.publishDate}
                    onChange={(event) => update("publishDate", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.publishDate)}
                  />
                  <FieldError errors={errorFor("publishDate")} />
                </Field>
              )}
              {shows("updatedDate") && (
                <Field data-invalid={Boolean(fieldErrors.updatedDate)}>
                  <FieldLabel htmlFor="content-updated">Last updated</FieldLabel>
                  <Input
                    id="content-updated"
                    type="date"
                    value={form.updatedDate}
                    onChange={(event) => update("updatedDate", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.updatedDate)}
                  />
                  <FieldError errors={errorFor("updatedDate")} />
                </Field>
              )}
              {shows("createdDate") && (
                <Field data-invalid={Boolean(fieldErrors.createdDate)}>
                  <FieldLabel htmlFor="content-created">Date created</FieldLabel>
                  <Input
                    id="content-created"
                    type="date"
                    value={form.createdDate}
                    onChange={(event) => update("createdDate", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.createdDate)}
                  />
                  <FieldError errors={errorFor("createdDate")} />
                </Field>
              )}
            </div>
          )}

          {shows("views") && (
            <Field data-invalid={Boolean(fieldErrors.views)}>
              <FieldLabel htmlFor="content-views">Views</FieldLabel>
              <Input
                id="content-views"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.views}
                onChange={(event) => update("views", event.target.value)}
                aria-invalid={Boolean(fieldErrors.views)}
                aria-describedby="content-views-help"
              />
              <p id="content-views-help" className="text-xs text-muted-foreground">
                Enter the latest total from your analytics source. Views are updated manually.
              </p>
              <FieldError errors={errorFor("views")} />
            </Field>
          )}

          <Field data-invalid={Boolean(fieldErrors.notes)}>
            <FieldLabel htmlFor="content-notes">Notes</FieldLabel>
            <Textarea
              id="content-notes"
              rows={form.status === "Idea" ? 5 : 3}
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder={
                form.status === "Idea"
                  ? "Angles, references and who it is for."
                  : "Follow-ups, reminders and ideas to reuse."
              }
              aria-invalid={Boolean(fieldErrors.notes)}
            />
            <FieldError errors={errorFor("notes")} />
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-2xl">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>
          Cancel
        </Button>
        {!isEditing && (
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => void save(true)}>
            Create and add another
          </Button>
        )}
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Spinner data-icon="inline-start" />}
          {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
