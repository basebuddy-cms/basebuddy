import { NextResponse } from "next/server";

import {
  type AuthenticatedProjectApiRouteContext,
  withAuthenticatedPreparedProjectRoute,
} from "@/lib/api/project-api-auth";
import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";
import { enforceRateLimit } from "@/lib/api/request-guards";
import {
  buildProjectMemberInvitationPath,
  getProjectMemberInvitationStatus,
  type ProjectMemberInvitationsPayload,
} from "@/lib/control-plane/member-invitations";
import {
  normalizeProjectMemberAuthorScopeCanPublish,
  type ProjectMemberAuthorScope,
} from "@/lib/control-plane/members";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";

export const runtime = "nodejs";
const PROJECT_INVITATIONS_PAGE_SIZE = 100;

const logProjectMemberInvitationRevokeRouteError = (
  operation: string,
  error: unknown,
  metadata: Record<string, string | null | undefined> = {},
) => {
  console.error("[project-member-invitation-revoke-route]", {
    error,
    ...metadata,
    operation,
  });
};

type ProjectMemberInvitationsRow = {
  accepted_at: string | null;
  author_scopes:
    | Array<{
        canPublish?: boolean;
        can_publish?: boolean;
        cmsAuthorId?: string;
        cms_author_id?: string;
      }>
    | null;
  created_at: string;
  expires_at: string;
  invitation_id: string;
  invited_email: string;
  public_token: string;
  revoked_at: string | null;
  role_keys: string[] | null;
};

const normalizeAuthorScopes = (value: ProjectMemberInvitationsRow["author_scopes"]): ProjectMemberAuthorScope[] =>
  Array.isArray(value)
    ? value
        .map((scope) => ({
          canPublish: normalizeProjectMemberAuthorScopeCanPublish(scope?.canPublish ?? scope?.can_publish),
          cmsAuthorId: String(scope?.cmsAuthorId ?? scope?.cms_author_id ?? "").trim(),
        }))
        .filter((scope) => scope.cmsAuthorId)
    : [];

const normalizeInvitation = (row: ProjectMemberInvitationsRow) => ({
  acceptedAt: row.accepted_at,
  authorScopes: normalizeAuthorScopes(row.author_scopes),
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  invitationId: row.invitation_id,
  invitePath: buildProjectMemberInvitationPath(row.public_token),
  invitedEmail: row.invited_email,
  revokedAt: row.revoked_at,
  roles: row.role_keys ?? [],
  status: getProjectMemberInvitationStatus({
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }),
});

const loadProjectMemberInvitationsPayload = async ({
  projectId,
  supabase,
}: {
  projectId: string;
  supabase: AuthenticatedProjectApiRouteContext["supabase"];
}) => {
  const { data, error } = await supabase.rpc("get_project_member_invitations", {
    p_limit: PROJECT_INVITATIONS_PAGE_SIZE + 1,
    p_offset: 0,
    p_project_id: projectId,
  });

  if (error) {
    logProjectMemberInvitationRevokeRouteError("list", error, {
      projectId,
    });

    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProjectAccessRouteErrorMessage(error, "members"));
  }

  const invitationRows = ((data ?? []) as ProjectMemberInvitationsRow[]).slice(0, PROJECT_INVITATIONS_PAGE_SIZE);

  return {
    hasMoreInvitations: ((data ?? []) as ProjectMemberInvitationsRow[]).length > PROJECT_INVITATIONS_PAGE_SIZE,
    invitationPage: 1,
    invitationPageSize: PROJECT_INVITATIONS_PAGE_SIZE,
    invitations: invitationRows.map(normalizeInvitation),
  } satisfies ProjectMemberInvitationsPayload;
};

export const DELETE = withAuthenticatedPreparedProjectRoute(
  async (request, { projectId, supabase, user }) => {
    const rateLimitError = enforceRateLimit({
      bucket: "api:project-member-invitations:delete",
      key: user.id,
      limit: 20,
      request,
      windowMs: 60_000,
    });

    if (rateLimitError) {
      return rateLimitError;
    }

    const requestUrl = new URL(request.url);
    const invitationId = requestUrl.pathname.split("/").filter(Boolean).at(-1)?.trim() ?? "";

    if (!invitationId) {
      return NextResponse.json({ error: "Project invitation not found." }, { status: 404 });
    }

    try {
      const { error } = await supabase.rpc("revoke_project_member_invitation", {
        p_invitation_id: invitationId,
        p_project_id: projectId,
      });

      if (error) {
        logProjectMemberInvitationRevokeRouteError("revoke", error, {
          invitationId,
          projectId,
        });

        if (isControlPlaneSetupError(error)) {
          return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
        }

        const message = getProjectAccessRouteErrorMessage(error, "members");
        return NextResponse.json(
          { error: message },
          { status: getProjectAccessRouteErrorStatus(message, "members") },
        );
      }

      const refreshedPayload = await loadProjectMemberInvitationsPayload({
        projectId,
        supabase,
      });

      return NextResponse.json(refreshedPayload satisfies ProjectMemberInvitationsPayload);
    } catch (error) {
      logProjectMemberInvitationRevokeRouteError("revoke:unhandled", error, {
        invitationId,
        projectId,
      });

      const message = getProjectAccessRouteErrorMessage(error, "members");
      return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
    }
  },
);
