import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type AuthenticatedProjectApiRouteContext,
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
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import { DEFAULT_PROJECT_ROLE_DEFINITIONS } from "@/lib/control-plane/members";
import type {
  ProjectMemberAuthorScope,
  ProjectMembersMutationPayload,
  ProjectMembersPayload,
} from "@/lib/control-plane/members";
import { normalizeProjectMemberAuthorScopeCanPublish } from "@/lib/control-plane/members";
import { getContentAuthorOptions } from "@/lib/content-runtime/server";
export const runtime = "nodejs";

type ProjectMembersRow = {
  author_scopes:
    | Array<{
        canPublish?: boolean;
        can_publish?: boolean;
        cmsAuthorId?: string;
        cms_author_id?: string;
      }>
    | null;
  avatar_url: string | null;
  email: string | null;
  joined_at: string;
  name: string | null;
  role_keys: string[] | null;
  user_id: string;
};

type ProjectRoleRow = {
  description: string;
  label: string;
  priority: number;
  role_key: string;
};

type CurrentProjectAccessRow = {
  permission_keys: string[] | null;
  role_keys: string[] | null;
};

const normalizeAuthorScopes = (value: ProjectMembersRow["author_scopes"]): ProjectMemberAuthorScope[] =>
  Array.isArray(value)
    ? value
        .map((scope) => ({
          canPublish: normalizeProjectMemberAuthorScopeCanPublish(scope?.canPublish ?? scope?.can_publish),
          cmsAuthorId: String(scope?.cmsAuthorId ?? scope?.cms_author_id ?? "").trim(),
        }))
        .filter((scope) => scope.cmsAuthorId)
    : [];

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
  supabase,
}: {
  currentUserId: string;
  page?: number;
  projectId: string;
  pageSize?: number;
  supabase: AuthenticatedProjectApiRouteContext["supabase"];
}) => {
  const boundedPage = Math.max(1, page);
  const boundedPageSize = Math.max(1, Math.min(pageSize, PROJECT_MEMBERS_PAGE_SIZE));
  const offset = (boundedPage - 1) * boundedPageSize;
  const [
    { data: accessData, error: accessError },
    { data: membersData, error: membersError },
    { data: roleData, error: roleError },
  ] = await Promise.all([
    supabase.rpc("get_current_project_member_access", {
      p_project_id: projectId,
    }),
    supabase.rpc("get_project_members", {
      p_limit: boundedPageSize + 1,
      p_offset: offset,
      p_project_id: projectId,
    }),
    supabase
      .from("basebuddy_project_roles")
      .select("role_key, label, description, priority")
      .order("priority", { ascending: false }),
  ]);

  for (const error of [accessError, membersError, roleError]) {
    if (error) {
      if (isControlPlaneSetupError(error)) {
        throw new Error(APP_SETUP_REQUIRED_MESSAGE);
      }

      throw new Error(getProjectAccessRouteErrorMessage(error, "members"));
    }
  }

  let availableAuthors: ProjectMembersPayload["availableAuthors"] = [];

  try {
    availableAuthors = await getContentAuthorOptions({
      limit: 100,
      projectId,
    });
  } catch {
    availableAuthors = [];
  }

  const access = ((Array.isArray(accessData) ? accessData[0] : accessData) ?? null) as CurrentProjectAccessRow | null;
  const permissionKeys = access?.permission_keys ?? [];
  const currentRoleKeys = access?.role_keys ?? [];
  const memberRows = ((membersData ?? []) as ProjectMembersRow[]).slice(0, boundedPageSize);
  const roleRows =
    ((roleData ?? []) as ProjectRoleRow[]).length > 0
      ? ((roleData ?? []) as ProjectRoleRow[])
      : DEFAULT_PROJECT_ROLE_DEFINITIONS.map((role) => ({
          description: role.description,
          label: role.label,
          priority: role.priority,
          role_key: role.roleKey,
        }));
  const availableRoleRows = currentRoleKeys.includes("owner")
    ? roleRows
    : roleRows.filter((role) => role.role_key !== "owner");

  return {
    availableAuthors,
    availableRoles: availableRoleRows.map((role) => ({
      description: role.description,
      label: role.label,
      priority: role.priority,
      roleKey: role.role_key,
    })),
    capabilities: {
      canInviteMembers: permissionKeys.includes("member.invite"),
      canManageMembers: permissionKeys.includes("member.manage"),
    },
    currentUserId,
    hasMoreMembers: ((membersData ?? []) as ProjectMembersRow[]).length > boundedPageSize,
    memberPage: boundedPage,
    memberPageSize: boundedPageSize,
    members: memberRows.map((member) => ({
      authorScopes: normalizeAuthorScopes(member.author_scopes),
      avatarUrl: member.avatar_url,
      email: member.email,
      joinedAt: member.joined_at,
      name: member.name,
      roles: member.role_keys ?? [],
      userId: member.user_id,
    })),
  } satisfies ProjectMembersPayload;
};

export const GET = withAuthenticatedProjectRoute(async (request, { projectId, supabase, user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await loadProjectMembersPayload({
      currentUserId: user.id,
      page: parsePositiveInteger(searchParams.get("page"), 1),
      pageSize: parsePositiveInteger(searchParams.get("pageSize"), PROJECT_MEMBERS_PAGE_SIZE),
      projectId,
      supabase,
    });

    return NextResponse.json(payload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const POST = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
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
    const { error } = await supabase.rpc("add_project_member_by_email", {
      p_author_scopes: payload.authorScopes,
      p_email: payload.email.trim(),
      p_project_id: projectId,
      p_roles: payload.roles,
    });

    if (error) {
      if (isControlPlaneSetupError(error)) {
        return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
      }

      const message = getProjectAccessRouteErrorMessage(error, "members");
      return NextResponse.json(
        { error: message },
        { status: getProjectAccessRouteErrorStatus(message, "members") },
      );
    }

    invalidateControlPlaneRuntimeCache({
      projectId,
    });
    invalidateContentProjectContextCaches(projectId);

    const refreshedPayload = await loadProjectMembersPayload({
      currentUserId: user.id,
      projectId,
      supabase,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const PATCH = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
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
    const { error } = await supabase.rpc("update_project_member_access", {
      p_author_scopes: payload.authorScopes,
      p_project_id: projectId,
      p_roles: payload.roles,
      p_user_id: payload.userId,
    });

    if (error) {
      if (isControlPlaneSetupError(error)) {
        return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
      }

      const message = getProjectAccessRouteErrorMessage(error, "members");
      return NextResponse.json(
        { error: message },
        { status: getProjectAccessRouteErrorStatus(message, "members") },
      );
    }

    invalidateControlPlaneRuntimeCache({
      projectId,
    });
    invalidateContentProjectContextCaches(projectId);

    const refreshedPayload = await loadProjectMembersPayload({
      currentUserId: user.id,
      projectId,
      supabase,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});

export const DELETE = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
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
    const { error } = await supabase.rpc("remove_project_member", {
      p_project_id: projectId,
      p_user_id: userId,
    });

    if (error) {
      if (isControlPlaneSetupError(error)) {
        return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
      }

      const message = getProjectAccessRouteErrorMessage(error, "members");
      return NextResponse.json(
        { error: message },
        { status: getProjectAccessRouteErrorStatus(message, "members") },
      );
    }

    invalidateControlPlaneRuntimeCache({
      projectId,
    });
    invalidateContentProjectContextCaches(projectId);

    const refreshedPayload = await loadProjectMembersPayload({
      currentUserId: user.id,
      projectId,
      supabase,
    });

    return NextResponse.json(refreshedPayload satisfies ProjectMembersPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "members");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "members") });
  }
});
