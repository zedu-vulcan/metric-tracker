"use client";

import { useProject, type CurrentProject } from "@/components/projects/ProjectProvider";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOutIcon, UserRoundIcon } from "lucide-react";
import { MobileNav } from "@/components/AppSidebar";
import { AgentSwitcher } from "@/components/agents/AgentSwitcher";
import { ProjectSwitcher } from "@/components/projects/ProjectSwitcher";
import { NewTaskButton } from "@/components/tasks/NewTaskButton";
import { PointsTotal } from "@/components/tasks/PointsTotal";
import { InboxMenu } from "@/components/profile/InboxMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  return (
    <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-end gap-1.5 border-b border-border bg-background px-4 sm:gap-3 sm:px-6 lg:static">
      <MobileNav />
      <div className="mr-auto flex min-w-0">
        <ProjectSwitcher projects={projects} />
      </div>
      <div className="hidden sm:flex">
        <PointsTotal />
      </div>
      <NewTaskButton />
      <AgentSwitcher />
      <InboxMenu />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account menu for ${name}`}
          className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground transition-shadow outline-none hover:ring-4 hover:ring-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {image ? (
            <img src={image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            initials
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            {email && email !== name && <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
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
