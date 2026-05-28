import { NextResponse } from "next/server";
import { z } from "zod";

import {
  withAuthenticatedPreparedProjectRoute,
  withAuthenticatedProjectRoute,
} from "@/lib/api/project-api-auth";
import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";
import { parseJsonBody, enforceRateLimit } from "@/lib/api/request-guards";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { invalidateContentProjectContextCaches } from "@/lib/content-runtime/server-project-context";
import { DEFAULT_PROJECT_ROLE_DEFINITIONS } from "@/lib/control-plane/members";
import type {
  ProjectMembersMutationPayload,
  ProjectMembersPayload,
} from "@/lib/control-plane/members";
import { getContentAuthorOptions } from "@/lib/content-runtime/server";
import {
  addConfigProjectMemberByEmail,
  listConfigProjectMembers,
  removeConfigProjectMember,
  updateConfigProjectMemberAccess,
} from "@/lib/basebuddy-config/projects";
export const runtime = "nodejs";

const projectRoleKeys = DEFAULT_PROJECT_ROLE_DEFINITIONS.map((role) => role.roleKey);
const validProjectRoleKeys = new Set(projectRoleKeys);
const PROJECT_MEMBERS_PAGE_SIZE = 100;

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const roleKeySchema = z.string().trim().min(1, "Select at least one role.").max(50, "Role key is too long.").refine(
  (value) => validProjectRoleKeys.has(value),
  "Unsupported role.",
);

const authorScopeSchema = z.object({
  canPublish: z.boolean().optional().default(true),
  cmsAuthorId: z.string().trim().min(1, "Author scope is missing a content author.").max(200, "Content author id is too long."),
});

const addProjectMemberSchema = z.object({
  action: z.literal("add_member"),
  authorScopes: z.array(authorScopeSchema).max(50, "Author scopes cannot exceed 50 entries."),
  email: z.string().trim().email("Enter a valid email address.").max(320, "Email address is too long."),
  roles: z.array(roleKeySchema).min(1, "Select at least one role.").max(projectRoleKeys.length, "Too many roles were provided."),
});

const updateProjectMemberSchema = z.object({
  action: z.literal("update_member"),
  authorScopes: z.array(authorScopeSchema).max(50, "Author scopes cannot exceed 50 entries."),
  roles: z.array(roleKeySchema).min(1, "Select at least one role.").max(projectRoleKeys.length, "Too many roles were provided."),
  userId: z.string().trim().min(1, "Select a member first.").max(200, "User id is too long."),
});

const deleteProjectMemberSchema = z.object({
  userId: z.string().trim().min(1, "Select a member first.").max(200, "User id is too long."),
});

const loadProjectMembersPayload = async ({
  currentUserId,
  page = 1,
  projectId,
  pageSize = PROJECT_MEMBERS_PAGE_SIZE,
}: {
  currentUserId: string;
  page?: number;
  projectId: string;
  pageSize?: number;
}) => {
  let availableAuthors: ProjectMembersPayload["availableAuthors"] = [];

  try {
    availableAuthors = await getContentAuthorOptions({
      limit: 100,
      projectId,
    });
  } catch {
    availableAuthors = [];
  }

  const memberPayload = await listConfigProjectMembers({
    currentUserId,
    page,
    pageSize,
    projectId,
  });
  const availableRoles = memberPayload.currentRoleKeys.includes("owner")
    ? DEFAULT_PROJECT_ROLE_DEFINITIONS
    : DEFAULT_PROJECT_ROLE_DEFINITIONS.filter((role) => role.roleKey !== "owner");

  return {
    availableAuthors,
    availableRoles,
    capabilities: {
      canInviteMembers: memberPayload.memberAccess.permissions.includes("member.invite"),
      canManageMembers: memberPayload.memberAccess.permissions.includes("member.manage"),
    },
    currentUserId,
    hasMoreMembers: memberPayload.hasMoreMembers,
    memberPage: memberPayload.memberPage,
    memberPageSize: memberPayload.memberPageSize,
    members: memberPayload.members,
  } satisfies ProjectMembersPayload;
};

export const GET = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await loadProjectMembersPayload({
      currentUserId: user.id,
      page: parsePositiveInteger(searchParams.get("page"), 1),
      pageSize: parsePositiveInteger(searchParams.get("pageSize"), PROJECT_MEMBERS_PAGE_SIZE),
      projectId,
    });

    return NextResponse.json(payload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const POST = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, addProjectMemberSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as ProjectMembersMutationPayload;

  if (payload.action !== "add_member") {
    return NextResponse.json({ error: "Unsupported members action." }, { status: 400 });
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-members:post",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    await addConfigProjectMemberByEmail({
      actorUserId: user.id,
      authorScopes: payload.authorScopes,
      email: payload.email.trim(),
      projectId,
      roles: payload.roles,
    });

    invalidateControlPlaneRuntimeCache({
      projectId,
    });
    invalidateContentProjectContextCaches(projectId);

    const refreshedPayload = await loadProjectMembersPayload({
      currentUserId: user.id,
      projectId,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const PATCH = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, updateProjectMemberSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as ProjectMembersMutationPayload;

  if (payload.action !== "update_member") {
    return NextResponse.json({ error: "Unsupported members action." }, { status: 400 });
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-members:patch",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    await updateConfigProjectMemberAccess({
      actorUserId: user.id,
      authorScopes: payload.authorScopes,
      projectId,
      roles: payload.roles,
      userId: payload.userId,
    });

    invalidateControlPlaneRuntimeCache({
      projectId,
    });
    invalidateContentProjectContextCaches(projectId);

    const refreshedPayload = await loadProjectMembersPayload({
      currentUserId: user.id,
      projectId,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const DELETE = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, deleteProjectMemberSchema, {
    maxBytes: 8 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data;
  const userId = payload.userId?.trim();

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-members:delete",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    await removeConfigProjectMember({
      actorUserId: user.id,
      projectId,
      userId,
    });

    invalidateControlPlaneRuntimeCache({
      projectId,
    });
    invalidateContentProjectContextCaches(projectId);

    const refreshedPayload = await loadProjectMembersPayload({
      currentUserId: user.id,
      projectId,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});
