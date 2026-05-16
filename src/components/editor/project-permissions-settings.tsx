"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getEffectivePermissionKeys,
  getProjectMemberPermissionState,
  toggleProjectMemberPermission,
} from "@/lib/control-plane/member-permission-overrides";
import {
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS,
  type ProjectPermissionDefinition,
  type ProjectPermissionMemberRecord,
  type ProjectPermissionsPayload,
  type UpdateProjectMemberPermissionsPayload,
} from "@/lib/control-plane/member-permissions";
import { getUserDisplayName } from "@/lib/control-plane/utils";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

type ProjectPermissionsSettingsProps = {
  projectId: string;
};

type EditablePermissionMember = ProjectPermissionMemberRecord & {
  isDirty: boolean;
  originalAllowPermissionKeys: string[];
  originalDenyPermissionKeys: string[];
};

export const permissionCategoryLabels: Record<ProjectPermissionDefinition["category"], string> = {
  project: "Project",
  member: "Members",
  content: "Content",
  author: "Authors",
  mapping: "Content setup",
  integration: "Integrations",
};

const permissionCategoryOrder: Record<ProjectPermissionDefinition["category"], number> = {
  project: 0,
  member: 1,
  content: 2,
  author: 3,
  mapping: 4,
  integration: 5,
};

const sortPermissions = (permissions: ProjectPermissionDefinition[]) =>
  [...permissions].sort((left, right) => {
    const categoryDifference = permissionCategoryOrder[left.category] - permissionCategoryOrder[right.category];

    if (categoryDifference !== 0) {
      return categoryDifference;
    }

    return left.label.localeCompare(right.label);
  });

const getPermissionsErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "Could not manage project permissions right now.";
};

const mapMembersToEditable = (members: ProjectPermissionMemberRecord[]): EditablePermissionMember[] =>
  members.map((member) => ({
    ...member,
    allowPermissionKeys: [...member.allowPermissionKeys],
    denyPermissionKeys: [...member.denyPermissionKeys],
    effectivePermissionKeys: [...member.effectivePermissionKeys],
    inheritedPermissionKeys: [...member.inheritedPermissionKeys],
    isDirty: false,
    originalAllowPermissionKeys: [...member.allowPermissionKeys],
    originalDenyPermissionKeys: [...member.denyPermissionKeys],
  }));

const hasMatchingKeys = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const formatRoleLabel = (roleKey: string) => roleKey.charAt(0).toUpperCase() + roleKey.slice(1);

export function ProjectPermissionsSettings({ projectId }: ProjectPermissionsSettingsProps) {
  const [permissions, setPermissions] = useState<ProjectPermissionDefinition[]>(() =>
    sortPermissions(DEFAULT_PROJECT_PERMISSION_DEFINITIONS),
  );
  const [members, setMembers] = useState<EditablePermissionMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

  const applyPayload = (payload: ProjectPermissionsPayload) => {
    const nextMembers = mapMembersToEditable(payload.members);
    const nextPermissions = Array.isArray(payload.permissions) ? payload.permissions : [];
    setPermissions(sortPermissions(nextPermissions.length ? nextPermissions : DEFAULT_PROJECT_PERMISSION_DEFINITIONS));
    setMembers(nextMembers);
    setCurrentUserId(payload.currentUserId);
    setSelectedMemberId((currentSelectedMemberId) => {
      if (currentSelectedMemberId && nextMembers.some((member) => member.userId === currentSelectedMemberId)) {
        return currentSelectedMemberId;
      }

      if (nextMembers.some((member) => member.userId === payload.currentUserId)) {
        return payload.currentUserId;
      }

      return nextMembers[0]?.userId ?? null;
    });
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/projects/${projectId}/permissions`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await getPermissionsErrorMessage(response));
        }

        if (!cancelled) {
          applyPayload((await response.json()) as ProjectPermissionsPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getProductionErrorMessage(error, "Could not load project permissions right now."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectedMember = members.find((member) => member.userId === selectedMemberId) ?? null;
  const currentMember = members.find((member) => member.userId === currentUserId) ?? null;
  const currentUserIsOwner = Boolean(currentMember?.roles.includes("owner"));
  const selectedMemberIsOwner = Boolean(selectedMember?.roles.includes("owner"));
  const canEditSelectedMember = Boolean(selectedMember && (currentUserIsOwner || !selectedMemberIsOwner));

  const permissionsByCategory = useMemo(() => {
    const grouped = new Map<ProjectPermissionDefinition["category"], ProjectPermissionDefinition[]>();

    for (const permission of permissions) {
      const currentGroup = grouped.get(permission.category) ?? [];
      currentGroup.push(permission);
      grouped.set(permission.category, currentGroup);
    }

    return grouped;
  }, [permissions]);

  const updateMember = (
    userId: string,
    updater: (member: EditablePermissionMember) => EditablePermissionMember,
  ) => {
    setMembers((currentMembers) =>
      currentMembers.map((member) => (member.userId === userId ? updater(member) : member)),
    );
  };

  const handlePermissionToggle = (permissionKey: string, nextEnabled: boolean) => {
    if (!selectedMember) {
      return;
    }

    if (!canEditSelectedMember || (!currentUserIsOwner && permissionKey === "project.delete")) {
      return;
    }

    updateMember(selectedMember.userId, (member) => {
      const nextOverrides = toggleProjectMemberPermission({
        allowPermissionKeys: member.allowPermissionKeys,
        denyPermissionKeys: member.denyPermissionKeys,
        inheritedPermissionKeys: member.inheritedPermissionKeys,
        nextEnabled,
        permissionKey,
      });

      const isDirty =
        !hasMatchingKeys(nextOverrides.allowPermissionKeys, member.originalAllowPermissionKeys) ||
        !hasMatchingKeys(nextOverrides.denyPermissionKeys, member.originalDenyPermissionKeys);

      return {
        ...member,
        allowPermissionKeys: nextOverrides.allowPermissionKeys,
        denyPermissionKeys: nextOverrides.denyPermissionKeys,
        effectivePermissionKeys: getEffectivePermissionKeys({
          allowPermissionKeys: nextOverrides.allowPermissionKeys,
          denyPermissionKeys: nextOverrides.denyPermissionKeys,
          inheritedPermissionKeys: member.inheritedPermissionKeys,
        }),
        isDirty,
      };
    });
  };

  const handleResetSelectedMember = () => {
    if (!selectedMember) {
      return;
    }

    updateMember(selectedMember.userId, (member) => ({
      ...member,
      allowPermissionKeys: [...member.originalAllowPermissionKeys],
      denyPermissionKeys: [...member.originalDenyPermissionKeys],
      effectivePermissionKeys: getEffectivePermissionKeys({
        allowPermissionKeys: member.originalAllowPermissionKeys,
        denyPermissionKeys: member.originalDenyPermissionKeys,
        inheritedPermissionKeys: member.inheritedPermissionKeys,
      }),
      isDirty: false,
    }));
  };

  const handleSaveSelectedMember = async () => {
    if (!selectedMember || !selectedMember.isDirty) {
      return;
    }

    setSavingMemberId(selectedMember.userId);

    try {
      const payload: UpdateProjectMemberPermissionsPayload = {
        allowPermissionKeys: selectedMember.allowPermissionKeys,
        denyPermissionKeys: selectedMember.denyPermissionKeys,
        userId: selectedMember.userId,
      };

      const response = await fetch(`/api/projects/${projectId}/permissions`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await getPermissionsErrorMessage(response));
      }

      updateMember(selectedMember.userId, (member) => ({
        ...member,
        isDirty: false,
        originalAllowPermissionKeys: [...member.allowPermissionKeys],
        originalDenyPermissionKeys: [...member.denyPermissionKeys],
      }));
      toast.success("Permissions updated.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not update permissions right now."));
    } finally {
      setSavingMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading permissions...
      </div>
    );
  }

  if (errorMessage) {
    return <p className="text-sm text-destructive">{errorMessage}</p>;
  }

  if (!members.length || !selectedMember) {
    return <p className="text-sm text-muted-foreground">No members available for permission management.</p>;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Members</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Pick one member and fine-tune what they can actually do.
          </p>
        </div>

        <div className="space-y-1">
          {members.map((member, index) => {
            const displayName = getUserDisplayName(member.email, member.name);
            const isCurrentUser = member.userId === currentUserId;
            const isSelected = member.userId === selectedMemberId;

            return (
              <div key={member.userId}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-0 py-3 text-left transition-colors",
                    isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setSelectedMemberId(member.userId)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isSelected ? <span className="h-2 w-2 rounded-full bg-foreground" /> : null}
                        <p className="truncate text-sm font-medium">{displayName}</p>
                        {isCurrentUser ? <span className="text-xs text-muted-foreground">You</span> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{member.email ?? "No email"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {member.roles.map((role) => formatRoleLabel(role)).join(", ")}
                      </p>
                    </div>
                    {member.isDirty ? <span className="text-xs text-muted-foreground">Unsaved</span> : null}
                  </div>
                </button>
                {index < members.length - 1 ? <Separator /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              {getUserDisplayName(selectedMember.email, selectedMember.name)}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {canEditSelectedMember
                ? "Role defaults stay on unless you switch them off. Switch something on that the role does not include to grant it only to this member."
                : "Only project owners can change owner permissions."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedMember.isDirty ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="px-0 text-muted-foreground"
                onClick={handleResetSelectedMember}
                disabled={savingMemberId === selectedMember.userId}
              >
                Reset
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="hero"
              disabled={!canEditSelectedMember || !selectedMember.isDirty || savingMemberId === selectedMember.userId}
              onClick={() => void handleSaveSelectedMember()}
            >
              {savingMemberId === selectedMember.userId ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>

        {Array.from(permissionsByCategory.entries()).map(([category, categoryPermissions]) => (
          <section key={category} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {permissionCategoryLabels[category]}
            </p>
            <div className="space-y-1">
              {categoryPermissions.map((permission, index) => {
                const permissionState = getProjectMemberPermissionState({
                  allowPermissionKeys: selectedMember.allowPermissionKeys,
                  denyPermissionKeys: selectedMember.denyPermissionKeys,
                  inheritedPermissionKeys: selectedMember.inheritedPermissionKeys,
                  permissionKey: permission.permissionKey,
                });
                const lockedReason = !canEditSelectedMember
                  ? "Only project owners can change owner permissions."
                  : !currentUserIsOwner && permission.permissionKey === "project.delete"
                    ? "Only project owners can change delete access."
                    : null;
                const permissionDescriptionId = `permission-${permission.permissionKey.replace(/[^a-z0-9]+/gi, "-")}-description`;
                const lockedReasonId = lockedReason
                  ? `permission-${permission.permissionKey.replace(/[^a-z0-9]+/gi, "-")}-locked`
                  : undefined;

                return (
                  <div key={permission.permissionKey}>
                    <div className="flex items-start justify-between gap-6 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{permission.label}</p>
                        <p id={permissionDescriptionId} className="mt-1 text-sm leading-6 text-muted-foreground">
                          {permission.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{permissionState.statusText}</p>
                        {lockedReason ? (
                          <p id={lockedReasonId} className="mt-1 text-xs text-muted-foreground">
                            {lockedReason}
                          </p>
                        ) : null}
                      </div>
                      <Switch
                        aria-label={`${permission.label} permission`}
                        aria-describedby={lockedReasonId ?? permissionDescriptionId}
                        checked={permissionState.effective}
                        onCheckedChange={(checked) => handlePermissionToggle(permission.permissionKey, checked)}
                        disabled={Boolean(lockedReason) || savingMemberId === selectedMember.userId}
                      />
                    </div>
                    {index < categoryPermissions.length - 1 ? <Separator /> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
