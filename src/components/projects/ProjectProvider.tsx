"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { ProjectRole } from "@prisma/client";
import { projectHref } from "@/lib/project-paths";
import { setActiveProject } from "@/lib/request-json";

export type CurrentProject = { id: string; name: string; slug: string; role: ProjectRole };

type ProjectContextValue = CurrentProject & {
  /** A dashboard path inside this project: `href("/tasks")` → `/p/<slug>/tasks`. */
  href: (path?: string) => string;
  /** Owners and admins manage members, the invite link, task types and point rules. */
  canManage: boolean;
};

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

/** The project the current page belongs to. Mounted by the `/p/[slug]` layout. */
export function ProjectProvider({ project, children }: { project: CurrentProject; children: React.ReactNode }) {
  // Set before children render, so their first requests already carry the project.
  if (typeof window !== "undefined") setActiveProject(project.id);

  useEffect(() => {
    // Remembered so `/dashboard` reopens the last project.
    document.cookie = `zedu_project=${project.slug}; path=/; max-age=31536000; samesite=lax`;
  }, [project.slug]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      ...project,
      href: (path = "") => projectHref(project.slug, path),
      canManage: project.role === "owner" || project.role === "admin",
    }),
    [project]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used inside ProjectProvider");
  return context;
}
