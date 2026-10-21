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
import { projectHref } from "@/lib/project-paths";
import { useProject, type CurrentProject } from "./ProjectProvider";

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "P";
}

/** The current project, with a menu to switch to another, create one or join one. */
export function ProjectSwitcher({ projects }: { projects: CurrentProject[] }) {
  const current = useProject();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Project: ${current.name}. Switch project`}
        className="flex h-10 max-w-56 min-w-0 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-left text-sm text-foreground transition-colors outline-none hover:border-border-strong hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:border-border-strong aria-expanded:bg-muted"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          aria-hidden="true"
        >
          {initial(current.name)}
        </span>
        <span className="hidden min-w-0 flex-1 flex-col leading-tight sm:flex">
          <span className="truncate font-semibold">{current.name}</span>
          <span className="truncate text-xs text-muted-foreground capitalize">{current.role}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
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
          <Link href="/projects/join">
            <LogInIcon aria-hidden="true" />
            Join with a code
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/projects/new">
            <PlusIcon aria-hidden="true" />
            Create a project
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
