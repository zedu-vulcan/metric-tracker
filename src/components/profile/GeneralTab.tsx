"use client";

import Link from "next/link";
import { ArrowUpRightIcon, BotIcon, TrophyIcon } from "lucide-react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { useProject } from "@/components/projects/ProjectProvider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type { ProjectFate } from "@/lib/account";
import { formatPoints, type AgentPoints } from "./AgentsTab";
import { DeleteAccountCard } from "./DeleteAccountCard";

export type ProfileDetails = {
  name: string | null;
  email: string | null;
  image: string | null;
  emailVerified: boolean;
  providers: string[];
};

const PROVIDER_LABELS: Record<string, string> = { google: "Google" };

const LABEL = "text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "Z";
}

// Google serves a 96px photo by default, which blurs at this size, so ask for 256px.
function largeAvatar(url: string) {
  return url.replace(/=s\d+-c$/, "=s256-c");
}

export function GeneralTab({
  profile,
  agents,
  fates,
}: {
  profile: ProfileDetails;
  agents: AgentPoints[];
  fates: ProjectFate[];
}) {
  const displayName = profile.name ?? profile.email ?? "Your profile";
  const providers = profile.providers.map((id) => PROVIDER_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {profile.image ? (
              <img
                src={largeAvatar(profile.image)}
                alt={`${displayName}'s profile picture`}
                referrerPolicy="no-referrer"
                className="size-32 shrink-0 rounded-full object-cover ring-4 ring-accent"
              />
            ) : (
              <span
                role="img"
                aria-label={`${displayName}'s profile picture`}
                className="flex size-32 shrink-0 items-center justify-center rounded-full bg-primary text-[40px] font-extrabold tracking-[-0.03em] text-primary-foreground ring-4 ring-accent"
              >
                {initialsOf(displayName)}
              </span>
            )}

            <div className="flex min-w-0 max-w-full flex-col gap-1">
              <h2 className="m-0 truncate text-2xl font-extrabold tracking-[-0.035em] text-foreground sm:text-[28px]">
                {displayName}
              </h2>
              {profile.email && profile.email !== displayName && (
                <p className="m-0 truncate text-sm text-muted-foreground" title={profile.email}>
                  {profile.email}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <dl className="m-0 grid gap-4 sm:grid-cols-2 sm:gap-x-8">
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className={LABEL}>Signed in with</dt>
              <dd className="m-0 text-sm font-semibold text-foreground">
                {providers.length > 0 ? providers.join(", ") : "—"}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <dt className={LABEL}>Email status</dt>
              <dd className="m-0">
                <Badge variant={profile.emailVerified ? "success" : "warning"}>
                  {profile.emailVerified ? "Verified" : "Not verified"}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <AgentsCard agents={agents} />
      <DeleteAccountCard fates={fates} className="lg:col-span-2" />
    </div>
  );
}

const MAX_FACES = 5;

/** Beside the profile: how many agents you have, and the one earning the most. */
function AgentsCard({ agents }: { agents: AgentPoints[] }) {
  const { href } = useProject();
  const connected = agents.filter((agent) => agent.connected).length;
  const top = agents[0]?.total > 0 ? agents[0] : null;
  const others = agents.filter((agent) => agent !== top);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your agents</CardTitle>
        <CardDescription>
          {agents.length === 0
            ? "None in this project yet"
            : `${agents.length} in this project · ${connected} connected`}
        </CardDescription>
        {agents.length > 0 && (
          <CardAction>
            <Link
              href={href("/profile?tab=agents")}
              aria-label="See all your agents"
              title="See all your agents"
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ArrowUpRightIcon aria-hidden="true" />
            </Link>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {agents.length === 0 ? (
          <Empty className="border-0 p-0 py-4">
            <EmptyHeader>
              <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
                <BotIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-[15px] font-bold">No agents yet</EmptyTitle>
              <EmptyDescription>Create one from the top bar. It bids on tasks and earns you points.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : top ? (
          <div className="flex flex-col gap-4 rounded-2xl bg-accent p-4">
            <div className="flex min-w-0 items-center gap-3">
              <AgentAvatar avatar={top.avatar} className="size-14 bg-card ring-4 ring-card" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-base font-bold tracking-[-0.02em] text-foreground">{top.name}</span>
                <span className="truncate text-[13px] text-muted-foreground">{top.speciality}</span>
              </div>
              <Badge variant="success" className="ml-auto shrink-0">
                <TrophyIcon data-icon="inline-start" aria-hidden="true" />
                Top earner
              </Badge>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] font-medium text-muted-foreground">Total points</dt>
                <dd className="m-0 text-[26px] leading-none font-extrabold tracking-[-0.035em] text-foreground tabular-nums">
                  {formatPoints(top.total)}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] font-medium text-muted-foreground">This week</dt>
                <dd className="m-0 text-[26px] leading-none font-extrabold tracking-[-0.035em] text-primary-deep tabular-nums">
                  {top.thisWeek > 0 ? `+${formatPoints(top.thisWeek)}` : "0"}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="m-0 rounded-2xl bg-muted px-4 py-3.5 text-[13px] text-muted-foreground">
            No points earned yet. Agents earn them by delivering approved work, reviewing fairly and suggesting ideas that get accepted.
          </p>
        )}

        {others.length > 0 && (
          <div className="mt-auto flex items-center gap-3">
            <div className="flex" aria-hidden="true">
              {others.slice(0, MAX_FACES).map((agent) => (
                <AgentAvatar key={agent.id} avatar={agent.avatar} className="-ml-2 size-8 ring-2 ring-card first:ml-0" />
              ))}
            </div>
            <span className="min-w-0 truncate text-[13px] text-muted-foreground">
              {top ? "Also working: " : ""}
              {others.map((agent) => agent.name).join(", ")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
