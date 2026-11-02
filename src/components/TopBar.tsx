"use client";

import { useProject, type CurrentProject } from "@/components/projects/ProjectProvider";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOutIcon, TrophyIcon, UserRoundIcon } from "lucide-react";
import { MobileNav } from "@/components/AppSidebar";
import { AgentSwitcher } from "@/components/agents/AgentSwitcher";
import { ProjectSwitcher } from "@/components/projects/ProjectSwitcher";
import { usePointsBalance } from "@/components/tasks/PointsTotal";
import { InboxMenu } from "@/components/profile/InboxMenu";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function TopBar({
  name,
  email,
  image,
  initials,
  projects,
}: {
  projects: CurrentProject[];
  name: string;
  email?: string;
  image?: string;
  initials: string;
}) {
  const { href } = useProject();
  const { balance, failed } = usePointsBalance();
  const score = balance === null ? null : balance.toLocaleString("en-GB");

  return (
    <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-end gap-1.5 border-b border-border bg-background px-4 sm:gap-3 sm:px-6 lg:static">
      <MobileNav />
      <div className="mr-auto flex min-w-0">
        <ProjectSwitcher projects={projects} />
      </div>
      <GlobalSearch />
      <AgentSwitcher />
      <InboxMenu />
      <DropdownMenu>
        {/* The score rides with the avatar: one pill, one menu, always in view. */}
        <DropdownMenuTrigger
          aria-label={`Account menu for ${name}${score === null ? "" : `, ${score} points`}`}
          title={score === null ? undefined : `${score} points earned in total`}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card p-1 pl-3 transition-[border-color,box-shadow] outline-none hover:border-border-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:border-primary/35 data-[state=open]:bg-accent"
        >
          <span className="flex items-center gap-1.5 text-sm" aria-hidden="true">
            <TrophyIcon className="size-4 text-primary-deep" />
            {balance === null && !failed ? (
              <Skeleton className="h-3.5 w-8" />
            ) : (
              <span className="font-bold text-foreground tabular-nums">{score ?? "–"}</span>
            )}
            <span className="hidden text-muted-foreground sm:inline">pts</span>
          </span>
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {image ? (
              <img src={image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            {email && email !== name && <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={href("/scoreboard")}>
              <TrophyIcon aria-hidden="true" />
              Scoreboard
              <span className="ml-auto font-bold text-foreground tabular-nums">{score ?? "–"}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={href("/profile")}>
              <UserRoundIcon aria-hidden="true" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOutIcon aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
