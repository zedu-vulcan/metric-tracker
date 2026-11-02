"use client";

import { useMemo, useState } from "react";
import type { ProjectRole } from "@prisma/client";
import { SearchXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PillSelect, SearchPill, Toolbar } from "@/components/Toolbar";
import { filterMembers, type MemberRoleFilter } from "@/lib/member-filter";

export type SettingsMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: ProjectRole;
  joinedAt: string;
};

const ROLE_LABEL: Record<ProjectRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };
const ROLE_BADGE: Record<ProjectRole, "default" | "info" | "secondary"> = {
  owner: "default",
  admin: "info",
  member: "secondary",
};

const ROLE_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

/**
 * Who's in the project, with search and a role filter. Filtering happens on the member list the
 * settings page already loaded, so it works offline of the API and never hides a permission.
 */
export function ProjectMembersCard({
  members,
  currentUserId,
  isOwner,
  canManage,
  pending,
  onChangeRole,
  onRemove,
}: {
  members: SettingsMember[];
  currentUserId: string;
  isOwner: boolean;
  canManage: boolean;
  pending: boolean;
  onChangeRole: (member: SettingsMember, role: ProjectRole) => void;
  onRemove: (member: SettingsMember) => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<MemberRoleFilter>("all");

  const term = query.trim().toLowerCase();
  const filtering = term !== "" || role !== "all";
  const roleName = role === "all" ? null : ROLE_LABEL[role];

  const shown = useMemo(() => filterMembers(members, { query, role }), [members, query, role]);

  const canRemove = (member: SettingsMember) =>
    member.role !== "owner" && (member.userId === currentUserId || isOwner || (canManage && member.role === "member"));

  const clearFilters = () => {
    setQuery("");
    setRole("all");
  };

  function emptyMessage() {
    const quoted = `“${query.trim()}”`;
    if (!filtering) return "This project has no members yet.";
    if (term && roleName) return `Nobody matches ${quoted} with the ${roleName.toLowerCase()} role.`;
    if (term) return `Nobody matches ${quoted}.`;
    return roleName ? `Nobody here has the ${roleName.toLowerCase()} role.` : "This project has no members yet.";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          <span aria-live="polite">
            {filtering
              ? `Showing ${shown.length} of ${members.length}`
              : `${members.length} ${members.length === 1 ? "person" : "people"}`}
          </span>
          . Admins manage members, the invite link and task types; only the owner changes roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Toolbar>
          <SearchPill value={query} onChange={setQuery} placeholder="Search by name or email" />
          <PillSelect
            label="Role"
            value={role}
            onChange={(value) => setRole(value as MemberRoleFilter)}
            options={ROLE_OPTIONS}
          />
        </Toolbar>

        {shown.length === 0 ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{filtering ? "No members match" : "No members yet"}</EmptyTitle>
              <EmptyDescription>{emptyMessage()}</EmptyDescription>
            </EmptyHeader>
            {filtering && (
              <EmptyContent>
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="grid min-w-0">
                      <span className="truncate font-medium text-foreground">
                        {member.name ?? member.email ?? "Unnamed"}
                        {member.userId === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                      </span>
                      {member.name && member.email && (
                        <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && member.role !== "owner" ? (
                      <NativeSelect
                        size="sm"
                        aria-label={`Role for ${member.name ?? member.email ?? "member"}`}
                        value={member.role}
                        disabled={pending}
                        onChange={(event) => onChangeRole(member, event.target.value as ProjectRole)}
                      >
                        <NativeSelectOption value="admin">Admin</NativeSelectOption>
                        <NativeSelectOption value="member">Member</NativeSelectOption>
                      </NativeSelect>
                    ) : (
                      <Badge variant={ROLE_BADGE[member.role]}>{ROLE_LABEL[member.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {member.joinedAt.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    {canRemove(member) && (
                      <Button variant="ghost" size="sm" onClick={() => onRemove(member)}>
                        {member.userId === currentUserId ? "Leave" : "Remove"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
