import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type AuthenticatedProjectApiRouteContext,
  withAuthenticatedPreparedProjectRoute,
} from "@/lib/api/project-api-auth";
import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";
import { enforceRateLimit, parseJsonBody } from "@/lib/api/request-guards";
import {
  buildProjectMemberInvitationPath,
  getProjectMemberInvitationStatus,
  type CreateProjectMemberInvitationPayload,
  type ProjectMemberInvitationsPayload,
} from "@/lib/control-plane/member-invitations";
import { createProjectMemberInvitationToken } from "@/lib/control-plane/member-invitations-server";
import {
  DEFAULT_PROJECT_ROLE_DEFINITIONS,
  normalizeProjectMemberAuthorScopeCanPublish,
  type ProjectMemberAuthorScope,
} from "@/lib/control-plane/members";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";

export const runtime = "nodejs";
const PROJECT_INVITATIONS_PAGE_SIZE = 100;

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const logProjectMemberInvitationRouteError = (
  operation: string,
  error: unknown,
  metadata: Record<string, string | null | undefined> = {},
) => {
  console.error("[project-member-invitations-route]", {
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
  page = 1,
  pageSize = PROJECT_INVITATIONS_PAGE_SIZE,
  projectId,
  supabase,
}: {
  page?: number;
  pageSize?: number;
  projectId: string;
  supabase: AuthenticatedProjectApiRouteContext["supabase"];
}) => {
  const boundedPage = Math.max(1, page);
  const boundedPageSize = Math.max(1, Math.min(pageSize, PROJECT_INVITATIONS_PAGE_SIZE));
  const offset = (boundedPage - 1) * boundedPageSize;
  const { data, error } = await supabase.rpc("get_project_member_invitations", {
    p_limit: boundedPageSize + 1,
    p_offset: offset,
    p_project_id: projectId,
  });

  if (error) {
    logProjectMemberInvitationRouteError("list", error, {
      projectId,
    });

    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProjectAccessRouteErrorMessage(error, "members"));
  }

  const invitationRows = ((data ?? []) as ProjectMemberInvitationsRow[]).slice(0, boundedPageSize);

  return {
    hasMoreInvitations: ((data ?? []) as ProjectMemberInvitationsRow[]).length > boundedPageSize,
    invitationPage: boundedPage,
    invitationPageSize: boundedPageSize,
    invitations: invitationRows.map(normalizeInvitation),
  } satisfies ProjectMemberInvitationsPayload;
};

const authorScopeSchema = z.object({
  canPublish: z.boolean().optional().default(true),
  cmsAuthorId: z.string().trim().min(1, "Author scope is missing a content author.").max(200, "Content author id is too long."),
});

const validProjectRoleKeys = new Set(DEFAULT_PROJECT_ROLE_DEFINITIONS.map((role) => role.roleKey));
const roleKeySchema = z.string().trim().min(1, "Select at least one role.").max(50, "Role key is too long.").refine(
  (value) => validProjectRoleKeys.has(value),
  "Unsupported role.",
);

const createProjectMemberInvitationSchema = z.object({
  authorScopes: z.array(authorScopeSchema).max(50, "Author scopes cannot exceed 50 entries."),
  email: z.string().trim().email("Enter a valid email address.").max(320, "Email address is too long."),
  roles: z.array(roleKeySchema)
    .min(1, "Select at least one role.")
    .max(validProjectRoleKeys.size, "Too many roles were provided."),
});

export const GET = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase }) => {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await loadProjectMemberInvitationsPayload({
      page: parsePositiveInteger(searchParams.get("page"), 1),
      pageSize: parsePositiveInteger(searchParams.get("pageSize"), PROJECT_INVITATIONS_PAGE_SIZE),
      projectId,
      supabase,
    });

    return NextResponse.json(payload satisfies ProjectMemberInvitationsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const POST = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
  const payloadResult = await parseJsonBody(request, createProjectMemberInvitationSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as CreateProjectMemberInvitationPayload;
  const rateLimitError = enforceRateLimit({
    bucket: "api:project-member-invitations:post",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const { error } = await supabase.rpc("create_project_member_invitation", {
      p_author_scopes: payload.authorScopes,
      p_email: payload.email.trim(),
      p_project_id: projectId,
      p_public_token: createProjectMemberInvitationToken(),
      p_roles: payload.roles,
    });

    if (error) {
      logProjectMemberInvitationRouteError("create", error, {
        invitedEmail: payload.email.trim(),
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
    logProjectMemberInvitationRouteError("create:unhandled", error, {
      invitedEmail: payload.email.trim(),
      projectId,
    });

    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});
