"use client";

import Link from "next/link";
import { CheckIcon, ChevronsUpDownIcon, LogInIcon, PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { projectHref } from "@/lib/project-paths";
import { useProject, type CurrentProject } from "./ProjectProvider";

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "P";
}

/** The current project, with a menu to switch to another, create one or join one. */
export function ProjectSwitcher({ projects, collapsed = false }: { projects: CurrentProject[]; collapsed?: boolean }) {
  const current = useProject();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Project: ${current.name}. Switch project`}
        title={collapsed ? current.name : undefined}
        className={cn(
          "flex shrink-0 items-center gap-2.5 rounded-2xl border border-sidebar-border px-2 py-1.5 text-left text-sm text-sidebar-foreground transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:mb-5 lg:py-2",
          collapsed && "lg:size-11 lg:justify-center lg:self-center lg:px-0"
        )}
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
          aria-hidden="true"
        >
          {initial(current.name)}
        </span>
        <span className={cn("flex min-w-0 flex-1 flex-col", collapsed && "lg:hidden")}>
          <span className="truncate font-semibold">{current.name}</span>
          <span className="truncate text-xs text-sidebar-muted-foreground capitalize">{current.role}</span>
        </span>
        <ChevronsUpDownIcon className={cn("size-4 shrink-0 text-sidebar-muted-foreground", collapsed && "lg:hidden")} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-64">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        {projects.map((project) => (
          <DropdownMenuItem key={project.id} asChild>
            <Link href={projectHref(project.slug)}>
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {project.id === current.id && <CheckIcon aria-label="Current project" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/projects/new">
            <PlusIcon aria-hidden="true" />
            Create a project
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/projects/join">
            <LogInIcon aria-hidden="true" />
            Join with a code
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
