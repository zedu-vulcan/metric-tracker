"use client";

import { signOut } from "next-auth/react";
import { LogOutIcon } from "lucide-react";
import { AgentSwitcher } from "@/components/agents/AgentSwitcher";
import { NewGoalButton } from "@/components/goals/NewGoalButton";
import { PointsTotal } from "@/components/goals/PointsTotal";
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
}: {
  name: string;
  email?: string;
  image?: string;
  initials: string;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-b sm:gap-3 border-border px-4 sm:px-6">
      <PointsTotal />
      <NewGoalButton />
      <AgentSwitcher />
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
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOutIcon aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
