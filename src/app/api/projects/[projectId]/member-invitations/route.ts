import { NextResponse } from "next/server";
import { z } from "zod";

import {
  withAuthenticatedPreparedProjectRoute,
} from "@/lib/api/project-api-auth";
import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";
import { enforceRateLimit, parseJsonBody } from "@/lib/api/request-guards";
import {
  type CreateProjectMemberInvitationPayload,
  type ProjectMemberInvitationsPayload,
} from "@/lib/control-plane/member-invitations";
import { createProjectMemberInvitationToken } from "@/lib/control-plane/member-invitations-server";
import {
  DEFAULT_PROJECT_ROLE_DEFINITIONS,
} from "@/lib/control-plane/members";
import {
  createConfigProjectMemberInvitation,
  listConfigProjectMemberInvitations,
} from "@/lib/basebuddy-config/projects";

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

const loadProjectMemberInvitationsPayload = async ({
  actorUserId,
  page = 1,
  pageSize = PROJECT_INVITATIONS_PAGE_SIZE,
  projectId,
}: {
  actorUserId: string;
  page?: number;
  pageSize?: number;
  projectId: string;
}) => {
  return listConfigProjectMemberInvitations({
    actorUserId,
    page,
    pageSize,
    projectId,
  });
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

export const GET = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await loadProjectMemberInvitationsPayload({
      actorUserId: user.id,
      page: parsePositiveInteger(searchParams.get("page"), 1),
      pageSize: parsePositiveInteger(searchParams.get("pageSize"), PROJECT_INVITATIONS_PAGE_SIZE),
      projectId,
    });

    return NextResponse.json(payload satisfies ProjectMemberInvitationsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const POST = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
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
    await createConfigProjectMemberInvitation({
      actorUserId: user.id,
      authorScopes: payload.authorScopes,
      email: payload.email.trim(),
      projectId,
      publicToken: createProjectMemberInvitationToken(),
      roles: payload.roles,
    });

    const refreshedPayload = await loadProjectMemberInvitationsPayload({
      actorUserId: user.id,
      projectId,
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
