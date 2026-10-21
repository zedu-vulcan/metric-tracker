"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, LogInIcon, PlusIcon, SearchIcon, SettingsIcon, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { projectHref } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { useProject, type CurrentProject } from "./ProjectProvider";

/** Show a filter box once the list is long enough to need one. */
const SEARCH_FROM = 7;

const ROLE_LABELS: Record<CurrentProject["role"], string> = { owner: "Owner", admin: "Admin", member: "Member" };

function monogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "P") + (words.length > 1 ? words[1][0] : "")).toUpperCase();
}

function ProjectTile({ name, current, className }: { name: string; current?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[10px] text-xs font-extrabold tracking-[-0.02em]",
        current ? "bg-primary text-primary-foreground" : "bg-accent text-primary-deep",
        className
      )}
    >
      {monogram(name)}
    </span>
  );
}

function ActionItem({ href, icon: Icon, title, hint }: { href: string; icon: LucideIcon; title: string; hint: string }) {
  return (
    <DropdownMenuItem asChild className="gap-3 rounded-xl px-2 py-2">
      <Link href={href}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-border text-muted-foreground">
          <Icon aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

/** The current project, with a menu to switch to another, join one with a code or create one. */
export function ProjectSwitcher({ projects }: { projects: CurrentProject[] }) {
  const current = useProject();
  const [query, setQuery] = useState("");

  const searchable = projects.length >= SEARCH_FROM;
  const needle = query.trim().toLowerCase();
  const shown = needle ? projects.filter((project) => project.name.toLowerCase().includes(needle)) : projects;
  // The project you're in leads the list; the rest keep their order.
  const ordered = [...shown].sort((a, b) => Number(b.id === current.id) - Number(a.id === current.id));

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger
        aria-label={`Project: ${current.name}. Switch project`}
        className="group flex h-11 max-w-72 min-w-0 items-center gap-3 rounded-full py-1 pr-1.5 pl-1 text-left text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-accent"
      >
        <ProjectTile
          name={current.name}
          current
          className="size-9 rounded-full text-[13px] ring-4 ring-accent transition-shadow group-aria-expanded:ring-card"
        />
        <span className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="truncate text-[15px] font-extrabold tracking-[-0.025em]">{current.name}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase transition-colors group-aria-expanded:bg-card group-aria-expanded:text-primary-deep">
            {ROLE_LABELS[current.role]}
          </span>
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors group-hover:border-border-strong group-hover:text-foreground group-aria-expanded:border-primary group-aria-expanded:text-primary-deep">
          <ChevronDownIcon
            className="size-4 transition-transform duration-150 group-aria-expanded:rotate-180"
            aria-hidden="true"
          />
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5">
        <div className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-2">
          <span className="text-[15px] font-bold tracking-[-0.02em] text-foreground">Your projects</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
            {projects.length}
          </span>
        </div>

        {searchable && (
          <label className="mx-1 mb-1.5 flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/12">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Find a project</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // The menu's type-to-select would otherwise grab the letters.
              onKeyDown={(event) => event.key !== "Escape" && event.key !== "ArrowDown" && event.stopPropagation()}
              placeholder="Find a project"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        )}

        <DropdownMenuGroup className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {ordered.length === 0 ? (
            <p className="m-0 px-2 py-6 text-center text-[13px] text-muted-foreground">No project matches “{query.trim()}”.</p>
          ) : (
            ordered.map((project) => {
              const isCurrent = project.id === current.id;
              return (
                <DropdownMenuItem
                  key={project.id}
                  asChild
                  className={cn("gap-3 rounded-xl px-2 py-2", isCurrent && "bg-accent/60")}
                >
                  <Link href={projectHref(project.slug)} aria-current={isCurrent ? "page" : undefined}>
                    <ProjectTile name={project.name} current={isCurrent} />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-semibold text-foreground">{project.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{ROLE_LABELS[project.role]}</span>
                    </span>
                    {isCurrent && <CheckIcon className="text-primary-deep" aria-label="Current project" />}
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>

        {current.canManage && (
          <DropdownMenuItem asChild className="mt-0.5 gap-3 rounded-xl px-2 py-2 text-[13px] font-medium text-muted-foreground">
            <Link href={current.href("/settings")}>
              <SettingsIcon className="mx-2" aria-hidden="true" />
              Settings for {current.name}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1.5" />
        <ActionItem href="/projects/join" icon={LogInIcon} title="Join with a code" hint="Use the code a teammate shared" />
        <ActionItem href="/projects/new" icon={PlusIcon} title="Create a project" hint="Start a new workspace for your team" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
