import type { ProjectMemberAuthorScope } from "./members";

export type ProjectMemberInvitationStatus = "accepted" | "expired" | "pending" | "revoked";

export type ProjectMemberInvitationRecipientState = "needs_auth" | "ready" | "wrong_account";

export type ProjectMemberInvitationRecord = {
  acceptedAt: string | null;
  authorScopes: ProjectMemberAuthorScope[];
  createdAt: string;
  expiresAt: string;
  invitationId: string;
  invitePath: string;
  invitedEmail: string;
  revokedAt: string | null;
  roles: string[];
  status: ProjectMemberInvitationStatus;
};

export type ProjectMemberInvitationsPayload = {
  hasMoreInvitations?: boolean;
  invitationPage?: number;
  invitationPageSize?: number;
  invitations: ProjectMemberInvitationRecord[];
};

export type CreateProjectMemberInvitationPayload = {
  authorScopes: ProjectMemberAuthorScope[];
  email: string;
  roles: string[];
};

export type AcceptProjectMemberInvitationResult = {
  redirectTo: string;
  status: "accepted" | "already_member";
};

export type ProjectMemberInvitationPreview = {
  acceptedAt: string | null;
  authorScopes: ProjectMemberAuthorScope[];
  expiresAt: string;
  invitePath: string;
  invitedEmail: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  revokedAt: string | null;
  roles: string[];
  status: ProjectMemberInvitationStatus;
};

export const normalizeProjectMemberInvitationEmail = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

export const buildProjectMemberInvitationPath = (publicToken: string) =>
  `/invite/${encodeURIComponent(publicToken)}`;

export const buildProjectMemberInvitationLoginPath = (
  publicToken: string,
  invitedEmail: string,
) => {
  const searchParams = new URLSearchParams({
    email: invitedEmail.trim(),
    next: buildProjectMemberInvitationPath(publicToken),
  });

  return `/login?${searchParams.toString()}`;
};

export const getProjectMemberInvitationStatus = ({
  acceptedAt,
  expiresAt,
  now = new Date().toISOString(),
  revokedAt,
}: {
  acceptedAt?: string | null;
  expiresAt?: string | null;
  now?: string;
  revokedAt?: string | null;
}): ProjectMemberInvitationStatus => {
  if (acceptedAt) {
    return "accepted";
  }

  if (revokedAt) {
    return "revoked";
  }

  if (expiresAt && Date.parse(expiresAt) <= Date.parse(now)) {
    return "expired";
  }

  return "pending";
};

export const getProjectMemberInvitationRecipientState = ({
  currentUserEmail,
  invitedEmail,
}: {
  currentUserEmail: string | null | undefined;
  invitedEmail: string | null | undefined;
}): ProjectMemberInvitationRecipientState => {
  const normalizedCurrentUserEmail = normalizeProjectMemberInvitationEmail(currentUserEmail);
  const normalizedInvitedEmail = normalizeProjectMemberInvitationEmail(invitedEmail);

  if (!normalizedCurrentUserEmail) {
    return "needs_auth";
  }

  return normalizedCurrentUserEmail === normalizedInvitedEmail ? "ready" : "wrong_account";
};
