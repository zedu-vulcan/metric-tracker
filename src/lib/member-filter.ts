import type { ProjectRole } from "@prisma/client";

export type MemberRoleFilter = ProjectRole | "all";

export type FilterableMember = {
  name: string | null;
  email: string | null;
  role: ProjectRole;
};

/**
 * The member list filter used by project settings: a partial, case-insensitive match on name or
 * email, combined with an optional role filter. Clearing both returns everyone, in the order given.
 */
export function filterMembers<T extends FilterableMember>(
  members: readonly T[],
  { query, role }: { query: string; role: MemberRoleFilter }
): T[] {
  const term = query.trim().toLowerCase();
  return members.filter((member) => {
    if (role !== "all" && member.role !== role) return false;
    if (!term) return true;
    return (member.name ?? "").toLowerCase().includes(term) || (member.email ?? "").toLowerCase().includes(term);
  });
}
