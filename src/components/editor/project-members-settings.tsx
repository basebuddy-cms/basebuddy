"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Copy, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  type CreateProjectMemberInvitationPayload,
  type ProjectMemberInvitationRecord,
  type ProjectMemberInvitationsPayload,
} from "@/lib/control-plane/member-invitations";
import {
  type ProjectMemberAuthorOption,
  type ProjectMemberAuthorScope,
  type ProjectMembersCapabilities,
  type ProjectMemberRecord,
  type ProjectMembersPayload,
  type ProjectRoleDefinition,
  type UpdateProjectMemberPayload,
} from "@/lib/control-plane/members";
import { formatProjectDate, getUserDisplayName, getUserInitials } from "@/lib/control-plane/utils";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProjectMembersSettingsProps = {
  projectId: string;
};

type ProjectMembersSettingsMode = "invite-members" | "members";

type EditableMember = ProjectMemberRecord & {
  isDirty: boolean;
};

const createDefaultNewMemberRoles = () => ["viewer"];

const getMemberErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "Could not update project members right now.";
};

const normalizeMemberRoles = (roles: string[]) => [...new Set(roles)];

const normalizeAuthorScopes = (authorScopes: ProjectMemberAuthorScope[]) => {
  const seen = new Set<string>();
  const normalizedScopes: ProjectMemberAuthorScope[] = [];

  for (const scope of authorScopes) {
    const cmsAuthorId = scope.cmsAuthorId.trim();

    if (!cmsAuthorId || seen.has(cmsAuthorId)) {
      continue;
    }

    seen.add(cmsAuthorId);
    normalizedScopes.push({
      canPublish: scope.canPublish !== false,
      cmsAuthorId,
    });
  }

  return normalizedScopes;
};

const toggleRole = (
  roles: string[],
  roleKey: string,
  checked: boolean,
  authorScopes: ProjectMemberAuthorScope[],
) => {
  const nextRoles = checked
    ? normalizeMemberRoles([...roles, roleKey])
    : roles.filter((role) => role !== roleKey);

  return {
    authorScopes: nextRoles.includes("author") ? authorScopes : [],
    roles: nextRoles,
  };
};

const toggleAuthorScope = (
  authorScopes: ProjectMemberAuthorScope[],
  cmsAuthorId: string,
  checked: boolean,
) => {
  if (checked) {
    return normalizeAuthorScopes([
      ...authorScopes,
      {
        canPublish: true,
        cmsAuthorId,
      },
    ]);
  }

  return authorScopes.filter((scope) => scope.cmsAuthorId !== cmsAuthorId);
};

const toggleAuthorScopePublish = (
  authorScopes: ProjectMemberAuthorScope[],
  cmsAuthorId: string,
  canPublish: boolean,
) =>
  normalizeAuthorScopes(
    authorScopes.map((scope) =>
      scope.cmsAuthorId === cmsAuthorId
        ? {
            ...scope,
            canPublish,
          }
        : scope,
    ),
  );

const canSubmitMemberAccess = (
  roles: string[],
  authorScopes: ProjectMemberAuthorScope[],
) => roles.length > 0 && (!roles.includes("author") || authorScopes.length > 0);

const mapMembersToEditable = (members: ProjectMemberRecord[]): EditableMember[] =>
  members.map((member) => ({
    ...member,
    authorScopes: normalizeAuthorScopes([...member.authorScopes]),
    isDirty: false,
    roles: [...member.roles],
  }));

const MemberRoleChecklist = ({
  availableRoles,
  disabled,
  onRoleToggle,
  roles,
}: {
  availableRoles: ProjectRoleDefinition[];
  disabled?: boolean;
  onRoleToggle: (roleKey: string, checked: boolean) => void;
  roles: string[];
}) => {
  return (
    <div className="space-y-4">
      {availableRoles.length ? null : (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          No project roles are available right now.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {availableRoles.map((role) => {
          const checked = roles.includes(role.roleKey);

          return (
            <button
              type="button"
              key={role.roleKey}
              className={cn(
                "inline-flex h-auto items-center rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus:outline-none focus:ring-0 focus:ring-offset-0",
                checked
                  ? "border-foreground/70 bg-foreground/85 text-background hover:bg-foreground/80"
                  : "border-foreground/45 bg-foreground/5 text-foreground hover:bg-foreground/8",
                disabled ? "cursor-not-allowed opacity-50" : "",
              )}
              disabled={disabled}
              aria-pressed={checked}
              onClick={() => onRoleToggle(role.roleKey, !checked)}
            >
              {role.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MemberAuthorScopeChecklist = ({
  authorScopes,
  availableAuthors,
  disabled,
  onAuthorScopeToggle,
  onAuthorScopePublishToggle,
  roles,
}: {
  authorScopes: ProjectMemberAuthorScope[];
  availableAuthors: ProjectMemberAuthorOption[];
  disabled?: boolean;
  onAuthorScopeToggle: (cmsAuthorId: string, checked: boolean) => void;
  onAuthorScopePublishToggle: (cmsAuthorId: string, canPublish: boolean) => void;
  roles: string[];
}) => {
  if (!roles.includes("author")) {
    return null;
  }

  return (
    <div className="space-y-4 border-t border-border/70 pt-4">
      <div>
        <p className="text-sm font-medium text-foreground">Author scopes</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose which author profiles this person can manage.
        </p>
      </div>

      {availableAuthors.length ? (
        <div className="flex flex-wrap gap-2">
          {availableAuthors.map((author) => {
            const scope = authorScopes.find((currentScope) => currentScope.cmsAuthorId === author.id);
            const checked = Boolean(scope);
            const canPublish = scope?.canPublish !== false;
            const label = author.name?.trim() || author.slug?.trim() || author.id;

            return (
              <div key={author.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-2 py-1">
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-auto items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors outline-none focus:outline-none focus:ring-0 focus:ring-offset-0",
                    checked
                      ? "border-primary/60 bg-primary/12 text-foreground"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                    disabled ? "cursor-not-allowed opacity-50" : "",
                  )}
                  disabled={disabled}
                  aria-pressed={checked}
                  onClick={() => onAuthorScopeToggle(author.id, !checked)}
                >
                  {label}
                </button>
                {checked ? (
                  <label className="inline-flex items-center gap-2 pr-1 text-xs text-muted-foreground">
                    <Switch
                      aria-label={`Allow ${label} to publish`}
                      checked={canPublish}
                      disabled={disabled}
                      onCheckedChange={(nextCanPublish) => onAuthorScopePublishToggle(author.id, nextCanPublish)}
                    />
                    Publish
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          Create project authors before assigning the author role.
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {authorScopes.length
          ? `${authorScopes.length} author scope${authorScopes.length === 1 ? "" : "s"} selected.`
          : "Pick at least one author scope for the author role."}
      </p>
    </div>
  );
};

const copyInvitationLink = async (invitePath: string) => {
  if (typeof window === "undefined") {
    return false;
  }

  const absoluteUrl = new URL(invitePath, window.location.origin).toString();

  try {
    await navigator.clipboard.writeText(absoluteUrl);
    return true;
  } catch {
    return false;
  }
};

const ProjectMembersSettingsContent = ({
  mode,
  projectId,
}: ProjectMembersSettingsProps & {
  mode: ProjectMembersSettingsMode;
}) => {
  const [members, setMembers] = useState<EditableMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectMemberInvitationRecord[]>([]);
  const [availableAuthors, setAvailableAuthors] = useState<ProjectMemberAuthorOption[]>([]);
  const [availableRoles, setAvailableRoles] = useState<ProjectRoleDefinition[]>([]);
  const [capabilities, setCapabilities] = useState<ProjectMembersCapabilities>({
    canInviteMembers: false,
    canManageMembers: false,
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRoles, setNewMemberRoles] = useState<string[]>(createDefaultNewMemberRoles());
  const [newMemberAuthorScopes, setNewMemberAuthorScopes] = useState<ProjectMemberAuthorScope[]>([]);
  const [submittingInvitation, setSubmittingInvitation] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const isInvitePage = mode === "invite-members";
  const currentUserIsOwner = members.some(
    (member) => member.userId === currentUserId && member.roles.includes("owner"),
  );
  const canEditMemberAccess = (member: EditableMember) =>
    capabilities.canManageMembers && (!member.roles.includes("owner") || currentUserIsOwner);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const membersResponse = await fetch(`/api/projects/${projectId}/members`, {
          cache: "no-store",
        });

        if (!membersResponse.ok) {
          throw new Error(await getMemberErrorMessage(membersResponse));
        }

        const membersPayload = (await membersResponse.json()) as ProjectMembersPayload;

        if (cancelled) {
          return;
        }

        applyMembersPayload(membersPayload);

        if (!isInvitePage || !membersPayload.capabilities.canInviteMembers) {
          setInvitations([]);
          return;
        }

        const invitationsResponse = await fetch(`/api/projects/${projectId}/member-invitations`, {
          cache: "no-store",
        });

        if (!invitationsResponse.ok) {
          throw new Error(await getMemberErrorMessage(invitationsResponse));
        }

        const invitationsPayload = (await invitationsResponse.json()) as ProjectMemberInvitationsPayload;

        if (cancelled) {
          return;
        }

        applyInvitationsPayload(invitationsPayload);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getProductionErrorMessage(
              error,
              isInvitePage ? "Could not load invite settings right now." : "Could not load project members right now.",
            ),
          );
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
  }, [isInvitePage, projectId]);

  const applyMembersPayload = (payload: ProjectMembersPayload) => {
    setAvailableAuthors(payload.availableAuthors);
    setAvailableRoles(payload.availableRoles);
    setCapabilities(payload.capabilities);
    setCurrentUserId(payload.currentUserId);
    setMembers(mapMembersToEditable(payload.members));
    setExpandedMemberIds((currentIds) =>
      currentIds.filter((memberId) => payload.members.some((member) => member.userId === memberId)),
    );
  };

  const applyInvitationsPayload = (payload: ProjectMemberInvitationsPayload) => {
    setInvitations(payload.invitations);
  };

  const updateEditableMember = (
    userId: string,
    updater: (member: EditableMember) => EditableMember,
  ) => {
    setMembers((currentMembers) =>
      currentMembers.map((member) => (member.userId === userId ? updater(member) : member)),
    );
  };

  const setMemberEditorOpen = (userId: string, open: boolean) => {
    setExpandedMemberIds((currentIds) => {
      if (open) {
        return currentIds.includes(userId) ? currentIds : [...currentIds, userId];
      }

      return currentIds.filter((memberId) => memberId !== userId);
    });
  };

  const handleCreateInvitation = async () => {
    if (
      !capabilities.canInviteMembers ||
      !newMemberEmail.trim() ||
      !canSubmitMemberAccess(newMemberRoles, newMemberAuthorScopes)
    ) {
      return;
    }

    setSubmittingInvitation(true);

    try {
      const payload: CreateProjectMemberInvitationPayload = {
        authorScopes: newMemberAuthorScopes,
        email: newMemberEmail.trim(),
        roles: newMemberRoles,
      };
      const response = await fetch(`/api/projects/${projectId}/member-invitations`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getMemberErrorMessage(response));
      }

      const invitationsPayload = (await response.json()) as ProjectMemberInvitationsPayload;
      applyInvitationsPayload(invitationsPayload);
      setNewMemberEmail("");
      setNewMemberRoles(createDefaultNewMemberRoles());
      setNewMemberAuthorScopes([]);

      const latestInvitation = invitationsPayload.invitations.find((invitation) => invitation.status === "pending");
      const copied = latestInvitation ? await copyInvitationLink(latestInvitation.invitePath) : false;

      toast.success(copied ? "Invite link created and copied." : "Invite link created.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not create that invite right now."));
    } finally {
      setSubmittingInvitation(false);
    }
  };

  const handleCopyInvitation = async (invitation: ProjectMemberInvitationRecord) => {
    const copied = await copyInvitationLink(invitation.invitePath);

    if (copied) {
      toast.success("Invite link copied.");
      return;
    }

    toast.error("Could not copy that invite link right now.");
  };

  const handleRevokeInvitation = async (invitation: ProjectMemberInvitationRecord) => {
    if (!capabilities.canInviteMembers) {
      return;
    }

    setRevokingInvitationId(invitation.invitationId);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/member-invitations/${encodeURIComponent(invitation.invitationId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(await getMemberErrorMessage(response));
      }

      applyInvitationsPayload((await response.json()) as ProjectMemberInvitationsPayload);
      toast.success("Invite revoked.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not revoke that invite right now."));
    } finally {
      setRevokingInvitationId(null);
    }
  };

  const handleMemberSave = async (member: EditableMember) => {
    if (!canEditMemberAccess(member) || !canSubmitMemberAccess(member.roles, member.authorScopes)) {
      return;
    }

    setSavingMemberId(member.userId);

    try {
      const payload: UpdateProjectMemberPayload = {
        action: "update_member",
        authorScopes: member.authorScopes,
        roles: member.roles,
        userId: member.userId,
      };
      const response = await fetch(`/api/projects/${projectId}/members`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await getMemberErrorMessage(response));
      }

      applyMembersPayload((await response.json()) as ProjectMembersPayload);
      setMemberEditorOpen(member.userId, false);
      toast.success("Member access updated.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not update that member right now."));
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleMemberRemove = async (member: EditableMember) => {
    if (!canEditMemberAccess(member)) {
      return;
    }

    setRemovingMemberId(member.userId);

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        body: JSON.stringify({ userId: member.userId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getMemberErrorMessage(response));
      }

      applyMembersPayload((await response.json()) as ProjectMembersPayload);
      toast.success("Member removed.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not remove that member right now."));
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isInvitePage ? "Loading invite members..." : "Loading members..."}
      </div>
    );
  }

  if (errorMessage) {
    return <p className="text-sm text-destructive">{errorMessage}</p>;
  }

  if (isInvitePage) {
    return (
      <div className="space-y-8">
        <div className="space-y-5 border-b border-border pb-8">
          <div>
            <h3 className="text-base font-semibold text-foreground">Create invite link</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Invite someone by email, assign their roles up front, and share the generated link with them.
            </p>
          </div>

          {!capabilities.canInviteMembers ? (
            <p className="text-sm text-muted-foreground">
              Your current access can view project settings, but it cannot create or revoke invite links.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="new-project-member-email" className="text-xs font-medium uppercase tracking-wider">
              Email
            </Label>
            <Input
              id="new-project-member-email"
              value={newMemberEmail}
              onChange={(event) => setNewMemberEmail(event.target.value)}
              className="h-10 border-border"
              placeholder="writer@example.com"
              disabled={submittingInvitation || !capabilities.canInviteMembers}
            />
          </div>

          <MemberRoleChecklist
            availableRoles={availableRoles}
            disabled={submittingInvitation || !capabilities.canInviteMembers}
            onRoleToggle={(roleKey, checked) =>
              setNewMemberRoles((currentRoles) => {
                const nextState = toggleRole(currentRoles, roleKey, checked, newMemberAuthorScopes);
                setNewMemberAuthorScopes(nextState.authorScopes);
                return nextState.roles;
              })
            }
            roles={newMemberRoles}
          />

          <MemberAuthorScopeChecklist
            authorScopes={newMemberAuthorScopes}
            availableAuthors={availableAuthors}
            disabled={submittingInvitation || !capabilities.canInviteMembers}
            onAuthorScopeToggle={(cmsAuthorId, checked) =>
              setNewMemberAuthorScopes((currentScopes) => toggleAuthorScope(currentScopes, cmsAuthorId, checked))
            }
            onAuthorScopePublishToggle={(cmsAuthorId, canPublish) =>
              setNewMemberAuthorScopes((currentScopes) =>
                toggleAuthorScopePublish(currentScopes, cmsAuthorId, canPublish),
              )
            }
            roles={newMemberRoles}
          />

          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Invitees must sign in with the same email address before they can join.
            </p>
            <Button
              type="button"
              size="sm"
              variant="hero"
              className="min-w-[164px]"
              disabled={
                !capabilities.canInviteMembers ||
                submittingInvitation ||
                !newMemberEmail.trim() ||
                !canSubmitMemberAccess(newMemberRoles, newMemberAuthorScopes)
              }
              onClick={() => void handleCreateInvitation()}
            >
              {submittingInvitation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create invite link
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Pending invites</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              These links are still active and waiting to be accepted.
            </p>
          </div>

          {!capabilities.canInviteMembers ? (
            <p className="text-sm text-muted-foreground">
              You do not have permission to view or revoke pending invites.
            </p>
          ) : pendingInvitations.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.invitationId}>
                    <TableCell className="font-medium text-foreground">{invitation.invitedEmail}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {invitation.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="capitalize">
                            {role}
                          </Badge>
                        ))}
                        {invitation.authorScopes.length ? (
                          <Badge variant="outline">
                            {invitation.authorScopes.length} author scope
                            {invitation.authorScopes.length === 1 ? "" : "s"}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatProjectDate(invitation.expiresAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCopyInvitation(invitation)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy link
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          disabled={!capabilities.canInviteMembers || revokingInvitationId === invitation.invitationId}
                          onClick={() => void handleRevokeInvitation(invitation)}
                        >
                          {revokingInvitationId === invitation.invitationId ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Revoking...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Revoke
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No pending invites right now.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Current members</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Owners and admins can review who already has access and update their roles here.
        </p>
      </div>

      {members.length ? (
        members.map((member) => {
          const displayName = getUserDisplayName(member.email, member.name);
          const avatarUrl = member.avatarUrl?.trim() || null;
          const isCurrentUser = member.userId === currentUserId;
          const isBusy = savingMemberId === member.userId || removingMemberId === member.userId;
          const isRoleEditorOpen = expandedMemberIds.includes(member.userId);
          const memberAccessEditable = canEditMemberAccess(member);
          const ownerMemberLocked = member.roles.includes("owner") && !currentUserIsOwner;

          return (
            <Collapsible
              key={member.userId}
              open={isRoleEditorOpen}
              onOpenChange={(open) => setMemberEditorOpen(member.userId, open)}
              className="rounded-lg border border-border/70 bg-background/80 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-11 w-11 border border-border bg-secondary">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback className="bg-secondary text-sm font-medium text-muted-foreground">
                      {getUserInitials(member.email, member.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                      {isCurrentUser ? <Badge variant="outline">You</Badge> : null}
                      {member.isDirty ? <Badge variant="outline">Unsaved</Badge> : null}
                      {member.roles.map((role) => (
                        <Badge key={role} variant="secondary" className="capitalize">
                          {role}
                        </Badge>
                      ))}
                      {member.authorScopes.length ? (
                        <Badge variant="outline">
                          {member.authorScopes.length} author scope{member.authorScopes.length === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{member.email ?? "No email"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Joined {formatProjectDate(member.joinedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="min-w-[132px] justify-between">
                      {isRoleEditorOpen ? "Close access" : "Manage access"}
                      <ChevronDown
                        className={`ml-2 h-4 w-4 transition-transform ${isRoleEditorOpen ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={!memberAccessEditable || isBusy}
                    onClick={() => void handleMemberRemove(member)}
                  >
                    {removingMemberId === member.userId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <CollapsibleContent className="pt-4">
                <div className="space-y-4 border-t border-border/70 pt-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Roles</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Owners and admins can change roles and author scopes here.
                    </p>
                    {ownerMemberLocked ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        Only project owners can change owner members.
                      </p>
                    ) : null}
                  </div>

                  <MemberRoleChecklist
                    availableRoles={availableRoles}
                    disabled={!memberAccessEditable || isBusy}
                    onRoleToggle={(roleKey, checked) =>
                      updateEditableMember(member.userId, (currentMember) => {
                        const nextState = toggleRole(
                          currentMember.roles,
                          roleKey,
                          checked,
                          currentMember.authorScopes,
                        );

                        return {
                          ...currentMember,
                          authorScopes: nextState.authorScopes,
                          isDirty: true,
                          roles: nextState.roles,
                        };
                      })
                    }
                    roles={member.roles}
                  />

                  <MemberAuthorScopeChecklist
                    authorScopes={member.authorScopes}
                    availableAuthors={availableAuthors}
                    disabled={!memberAccessEditable || isBusy}
                    onAuthorScopeToggle={(cmsAuthorId, checked) =>
                      updateEditableMember(member.userId, (currentMember) => ({
                        ...currentMember,
                        authorScopes: toggleAuthorScope(currentMember.authorScopes, cmsAuthorId, checked),
                        isDirty: true,
                      }))
                    }
                    onAuthorScopePublishToggle={(cmsAuthorId, canPublish) =>
                      updateEditableMember(member.userId, (currentMember) => ({
                        ...currentMember,
                        authorScopes: toggleAuthorScopePublish(currentMember.authorScopes, cmsAuthorId, canPublish),
                        isDirty: true,
                      }))
                    }
                    roles={member.roles}
                  />

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">Changes apply only after you save this member.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="hero"
                      disabled={
                        !memberAccessEditable ||
                        isBusy ||
                        !member.isDirty ||
                        !canSubmitMemberAccess(member.roles, member.authorScopes)
                      }
                      onClick={() => void handleMemberSave(member)}
                    >
                      {savingMemberId === member.userId ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save access"
                      )}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">No additional members yet.</p>
      )}
    </div>
  );
};

export function ProjectMembersSettings({ projectId }: ProjectMembersSettingsProps) {
  return <ProjectMembersSettingsContent projectId={projectId} mode="members" />;
}

export function ProjectMemberInvitationsSettings({ projectId }: ProjectMembersSettingsProps) {
  return <ProjectMembersSettingsContent projectId={projectId} mode="invite-members" />;
}
