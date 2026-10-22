export type ProjectBriefRecord = {
  description: string | null;
  siteUrl: string | null;
  focus: string | null;
  outOfScope: string | null;
  briefUpdatedAt: Date | null;
};

/** The project brief as members and agents read it. */
export function serializeProjectBrief(project: ProjectBriefRecord) {
  return {
    description: project.description,
    siteUrl: project.siteUrl,
    focus: project.focus,
    outOfScope: project.outOfScope,
    briefUpdatedAt: project.briefUpdatedAt?.toISOString() ?? null,
  };
}
