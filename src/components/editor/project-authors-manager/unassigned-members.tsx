"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUserDisplayName } from "@/lib/control-plane/utils";
import type { ContentAuthor } from "@/lib/content-runtime/shared";
import type { ProjectAuthorMember } from "@/lib/control-plane/authors";

type ProjectAuthorsUnassignedMembersProps = {
  authors: ContentAuthor[];
  pendingAssignments: Record<string, string>;
  settingUpMemberId: string | null;
  unassignedAuthorMembers: ProjectAuthorMember[];
  onAssignExistingAuthor: (member: ProjectAuthorMember) => void;
  onCreateAndAssignAuthor: (member: ProjectAuthorMember) => void;
  onPendingAssignmentChange: (memberId: string, authorId: string) => void;
};

export function ProjectAuthorsUnassignedMembers({
  authors,
  pendingAssignments,
  settingUpMemberId,
  unassignedAuthorMembers,
  onAssignExistingAuthor,
  onCreateAndAssignAuthor,
  onPendingAssignmentChange,
}: ProjectAuthorsUnassignedMembersProps) {
  if (!unassignedAuthorMembers.length) {
    return null;
  }

  return (
    <div className="mb-8 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">Members waiting for author setup</h3>
        <p className="text-sm text-muted-foreground">
          Choose an existing author profile or create one so each listed member writes under the right byline.
        </p>
      </div>
      <div className="space-y-3">
        {unassignedAuthorMembers.map((member) => {
          const displayName = getUserDisplayName(member.email, member.name);
          const isSettingUp = settingUpMemberId === member.userId;
          const selectedAuthorId = pendingAssignments[member.userId] ?? "";

          return (
            <div
              key={member.userId}
              className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email ?? "No email available"}</p>
              </div>
              <div className="flex flex-col gap-2 sm:min-w-[360px] sm:flex-row sm:items-center">
                <Select
                  value={selectedAuthorId || "unassigned"}
                  onValueChange={(value) =>
                    onPendingAssignmentChange(member.userId, value === "unassigned" ? "" : value)
                  }
                  disabled={isSettingUp || !authors.length}
                >
                  <SelectTrigger className="h-8 min-w-[220px] border-border bg-secondary text-xs">
                    <SelectValue placeholder="Assign existing author" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Assign existing author</SelectItem>
                    {authors.map((author) => (
                      <SelectItem key={author.id} value={author.id}>
                        {author.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSettingUp || !selectedAuthorId}
                  onClick={() => onAssignExistingAuthor(member)}
                >
                  {isSettingUp && selectedAuthorId ? "Assigning..." : "Assign"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="hero"
                  disabled={isSettingUp}
                  onClick={() => onCreateAndAssignAuthor(member)}
                >
                  {isSettingUp && !selectedAuthorId ? "Creating..." : "Create author"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
