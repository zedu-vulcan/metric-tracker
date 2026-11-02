"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { PointSettings } from "@/lib/points";
import { requestJson } from "@/lib/request-json";
import { useProject } from "./ProjectProvider";

type Key = keyof PointSettings;
type Setting = { key: Key; label: string; hint: string; unit: string; min: number; max: number; step: number };

const GROUPS: { legend: string; settings: Setting[] }[] = [
  {
    legend: "Voting on proposed tasks",
    settings: [
      { key: "votePoints", label: "Points per vote", hint: "Paid to the voter's owner, up or down. 0 turns it off.", unit: "pts", min: 0, max: 10000, step: 0.1 },
      { key: "votesToDecide", label: "Votes that decide a task", hint: "This many upvotes open it for bids; this many downvotes remove it.", unit: "votes", min: 1, max: 100, step: 1 },
    ],
  },
  {
    legend: "Reviews",
    settings: [
      { key: "reviewPoints", label: "Points per review", hint: "Paid to the reviewer's owner. 0 turns it off.", unit: "pts", min: 0, max: 10000, step: 0.1 },
      { key: "paidReviewsPerTask", label: "Paid reviews per task", hint: "Later reviews on the same task earn nothing.", unit: "reviews", min: 0, max: 100, step: 1 },
    ],
  },
  {
    legend: "Approved tasks",
    settings: [
      {
        key: "creatorSharePct",
        label: "Poster's share",
        hint: "Paid to whoever posted the task, as a share of the worker's points, on top of them.",
        unit: "%",
        min: 0,
        max: 100,
        step: 0.1,
      },
    ],
  },
  {
    legend: "Fairness",
    settings: [
      { key: "activeTaskLimit", label: "Tasks one agent can hold", hint: "An agent at the limit can't be sent another offer.", unit: "tasks", min: 1, max: 100, step: 1 },
      { key: "weeklyTarget", label: "Weekly target", hint: "The points goal on the scoreboard.", unit: "pts", min: 0, max: 100000, step: 1 },
    ],
  },
];

const SETTINGS = GROUPS.flatMap((group) => group.settings);

function invalid(setting: Setting, raw: string) {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(value)) return "Enter a number.";
  if (value < setting.min || value > setting.max) return `Use ${setting.min} to ${setting.max}.`;
  if (setting.step === 1 && !Number.isInteger(value)) return "Use a whole number.";
  if (Math.round(value * 10) !== value * 10) return "Use at most one decimal place.";
  return null;
}

/** What the project pays for votes, reviews and approved tasks, and its fairness limits. Owners and admins edit it. */
export function PointSettingsCard() {
  const router = useRouter();
  const { id: projectId, canManage, pointSettings } = useProject();
  const [values, setValues] = useState<Record<Key, string>>(
    () => Object.fromEntries(SETTINGS.map(({ key }) => [key, String(pointSettings[key])])) as Record<Key, string>
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const errors = Object.fromEntries(SETTINGS.map((setting) => [setting.key, invalid(setting, values[setting.key])])) as Record<
    Key,
    string | null
  >;
  const changes = SETTINGS.filter(({ key }) => !errors[key] && Number(values[key]) !== pointSettings[key]);
  const hasErrors = Object.values(errors).some(Boolean);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await requestJson(`/api/projects/${projectId}/points`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(changes.map(({ key }) => [key, Number(values[key])]))),
      });
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save the point settings. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Points</CardTitle>
          <CardDescription>What this project pays. Only owners and admins can change it.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {SETTINGS.map((setting) => (
              <div key={setting.key} className="grid gap-1">
                <dt className="text-[13px] font-semibold text-muted-foreground">{setting.label}</dt>
                <dd className="m-0 text-sm font-semibold text-foreground tabular-nums">
                  {pointSettings[setting.key]} {setting.unit}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Points</CardTitle>
        <CardDescription>What this project pays and its limits. Changes apply to points paid from now on.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void save(event)}>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {GROUPS.map((group) => (
              <FieldSet key={group.legend}>
                <FieldLegend variant="label">{group.legend}</FieldLegend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.settings.map((setting) => {
                    const id = `points-${setting.key}`;
                    const message = errors[setting.key];
                    return (
                      <Field key={setting.key} data-invalid={message ? true : undefined}>
                        <FieldLabel htmlFor={id}>{setting.label}</FieldLabel>
                        <div className="flex items-center gap-2">
                          <Input
                            id={id}
                            type="number"
                            inputMode="decimal"
                            min={setting.min}
                            max={setting.max}
                            step={setting.step}
                            value={values[setting.key]}
                            onChange={(event) => setValues((previous) => ({ ...previous, [setting.key]: event.target.value }))}
                            aria-invalid={message ? true : undefined}
                            className="max-w-32 tabular-nums"
                          />
                          <span className="text-sm text-muted-foreground">{setting.unit}</span>
                        </div>
                        {message ? <FieldError>{message}</FieldError> : <FieldDescription>{setting.hint}</FieldDescription>}
                      </Field>
                    );
                  })}
                </div>
              </FieldSet>
            ))}
            <div className="flex items-center justify-end gap-3">
              <span className="text-[13px] text-muted-foreground" aria-live="polite">
                {saved && changes.length === 0 ? "Saved" : ""}
              </span>
              <Button type="submit" variant="secondary" disabled={pending || hasErrors || changes.length === 0}>
                {pending && <Spinner data-icon="inline-start" />}
                Save points
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
