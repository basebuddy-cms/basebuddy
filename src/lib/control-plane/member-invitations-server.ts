import "server-only";

import { randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

import type { ProjectMemberAuthorScope } from "./members";
import { normalizeProjectMemberAuthorScopeCanPublish } from "./members";
import {
  buildProjectMemberInvitationPath,
  getProjectMemberInvitationStatus,
  type ProjectMemberInvitationPreview,
} from "./member-invitations";

type ProjectMemberInvitationPreviewRow = {
  accepted_at: string | null;
  author_scopes:
    | Array<{
        canPublish?: boolean;
        can_publish?: boolean;
        cmsAuthorId?: string;
        cms_author_id?: string;
      }>
    | null;
  expires_at: string;
  invited_email: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  revoked_at: string | null;
  role_keys: string[] | null;
};

const normalizeInvitationAuthorScopes = (
  value: ProjectMemberInvitationPreviewRow["author_scopes"],
): ProjectMemberAuthorScope[] =>
  Array.isArray(value)
    ? value
        .map((scope) => ({
          canPublish: normalizeProjectMemberAuthorScopeCanPublish(scope?.canPublish ?? scope?.can_publish),
          cmsAuthorId: String(scope?.cmsAuthorId ?? scope?.cms_author_id ?? "").trim(),
        }))
        .filter((scope) => scope.cmsAuthorId)
    : [];

export const createProjectMemberInvitationToken = () => randomBytes(24).toString("base64url");

const logProjectMemberInvitationPreviewError = (
  error: unknown,
  metadata: Record<string, string | number | null | undefined> = {},
) => {
  console.error("[project-member-invitation-preview]", {
    error,
    ...metadata,
  });
};

export const getProjectMemberInvitationPreview = async (
  publicToken: string,
): Promise<ProjectMemberInvitationPreview | null> => {
  const normalizedToken = publicToken.trim();

  if (!normalizedToken) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_project_member_invitation_preview", {
    p_public_token: normalizedToken,
  });

  if (error) {
    logProjectMemberInvitationPreviewError(error, {
      publicTokenSuffix: normalizedToken.slice(-6),
    });
    return null;
  }

  const invitation = ((Array.isArray(data) ? data[0] : data) ?? null) as ProjectMemberInvitationPreviewRow | null;

  if (!invitation) {
    return null;
  }

  const status = getProjectMemberInvitationStatus({
    acceptedAt: invitation.accepted_at,
    expiresAt: invitation.expires_at,
    revokedAt: invitation.revoked_at,
  });

  return {
    acceptedAt: invitation.accepted_at,
    authorScopes: normalizeInvitationAuthorScopes(invitation.author_scopes),
    expiresAt: invitation.expires_at,
    invitePath: buildProjectMemberInvitationPath(normalizedToken),
    invitedEmail: invitation.invited_email,
    projectId: invitation.project_id,
    projectName: invitation.project_name,
    projectSlug: invitation.project_slug,
    revokedAt: invitation.revoked_at,
    roles: invitation.role_keys ?? [],
    status,
  } satisfies ProjectMemberInvitationPreview;
};
