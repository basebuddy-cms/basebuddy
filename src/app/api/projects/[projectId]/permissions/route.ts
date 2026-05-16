import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type AuthenticatedProjectApiRouteContext,
  withAuthenticatedPreparedProjectAccessRoute,
} from "@/lib/api/project-api-auth";
import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";
import {
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS,
  DEFAULT_PROJECT_ROLE_PERMISSION_KEYS,
  type ProjectPermissionDefinition,
  type ProjectPermissionMemberRecord,
  type ProjectPermissionsPayload,
  type UpdateProjectMemberPermissionsPayload,
} from "@/lib/control-plane/member-permissions";
import { getEffectivePermissionKeys, normalizePermissionKeys } from "@/lib/control-plane/member-permission-overrides";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { parseJsonBody, enforceRateLimit } from "@/lib/api/request-guards";
import { invalidateContentProjectContextCaches } from "@/lib/content-runtime/server-project-context";

export const runtime = "nodejs";

type CurrentProjectAccessRow = {
  permission_keys: string[] | null;
  role_keys: string[] | null;
};

type ProjectMembersRow = {
  avatar_url: string | null;
  email: string | null;
  joined_at: string;
  name: string | null;
  role_keys: string[] | null;
  user_id: string;
};

type ProjectMemberGrantRow = {
  override_mode: "allow" | "deny" | null;
  permission_key: string;
  user_id: string;
};

const permissionCategoryOrder: Record<ProjectPermissionDefinition["category"], number> = {
  project: 0,
  member: 1,
  content: 2,
  author: 3,
  mapping: 4,
  integration: 5,
};

const validPermissionKeys = new Set(
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS.map((permission) => permission.permissionKey),
);

const permissionKeySchema = z.string().trim().min(1, "Invalid permission key.").max(200, "Permission key is too long.").refine(
  (value) => validPermissionKeys.has(value),
  "Invalid permission key.",
);

const updateProjectMemberPermissionsSchema = z.object({
  allowPermissionKeys: z.array(permissionKeySchema).max(validPermissionKeys.size, "Too many allow permissions were provided."),
  denyPermissionKeys: z.array(permissionKeySchema).max(validPermissionKeys.size, "Too many deny permissions were provided."),
  userId: z.string().trim().min(1, "Select a member first.").max(200, "User id is too long."),
}).refine(
  (value) => value.allowPermissionKeys.every((permissionKey) => !value.denyPermissionKeys.includes(permissionKey)),
  {
    message: "A permission cannot be both allowed and denied.",
    path: ["denyPermissionKeys"],
  },
);

const getProjectPermissionManagerAccess = async ({
  projectId,
  supabase,
}: {
  projectId: string;
  supabase: AuthenticatedProjectApiRouteContext["supabase"];
}) => {
  const { data: accessData, error: accessError } = await supabase.rpc("get_current_project_member_access", {
    p_project_id: projectId,
  });

  if (accessError) {
    if (isControlPlaneSetupError(accessError)) {
      return {
        access: null,
        errorResponse: NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 }),
      };
    }

    const message = getProjectAccessRouteErrorMessage(accessError, "permissions");
    return {
      access: null,
      errorResponse: NextResponse.json(
        { error: message },
        { status: getProjectAccessRouteErrorStatus(message, "permissions") },
      ),
    };
  }

  const access = ((Array.isArray(accessData) ? accessData[0] : accessData) ?? null) as CurrentProjectAccessRow | null;
  const currentRoles = access?.role_keys ?? [];
  const currentPermissions = access?.permission_keys ?? [];
  const canManagePermissions =
    (currentRoles.includes("owner") || currentRoles.includes("admin")) &&
    currentPermissions.includes("member.manage");

  if (!canManagePermissions) {
    return {
      access,
      errorResponse: NextResponse.json(
        { error: "Only project owners and admins can manage member permissions." },
        { status: 403 },
      ),
    };
  }

  return {
    access,
    errorResponse: null,
  };
};

const withProjectPermissionManagerRoute = <TResponse extends Response | Promise<Response>>(
  handler: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext & {
      access: CurrentProjectAccessRow | null;
    },
  ) => TResponse,
) =>
  withAuthenticatedPreparedProjectAccessRoute(
    async (_request, context) => {
      const accessResult = await getProjectPermissionManagerAccess({
        projectId: context.projectId,
        supabase: context.supabase,
      });

      if (accessResult.errorResponse) {
        return {
          context: null,
          errorResponse: accessResult.errorResponse,
        };
      }

      return {
        context: {
          access: accessResult.access,
        },
        errorResponse: null,
      };
    },
    handler,
  );

const loadProjectPermissionsPayload = async ({
  currentUserId,
  projectId,
  supabase,
}: {
  currentUserId: string;
  projectId: string;
  supabase: AuthenticatedProjectApiRouteContext["supabase"];
}) => {
  const [
    { data: membersData, error: membersError },
    { data: memberGrantsData, error: memberGrantsError },
  ] = await Promise.all([
    supabase.rpc("get_project_members", {
      p_limit: 101,
      p_offset: 0,
      p_project_id: projectId,
    }),
    supabase
      .from("basebuddy_project_member_grants")
      .select("user_id, permission_key, override_mode")
      .eq("project_id", projectId),
  ]);

  for (const error of [membersError, memberGrantsError]) {
    if (error) {
      if (isControlPlaneSetupError(error)) {
        throw new Error(APP_SETUP_REQUIRED_MESSAGE);
      }

      throw new Error(getProjectAccessRouteErrorMessage(error, "permissions"));
    }
  }

  const permissions = (DEFAULT_PROJECT_PERMISSION_DEFINITIONS as ProjectPermissionDefinition[])
    .sort((left, right) => {
      const categoryDifference = permissionCategoryOrder[left.category] - permissionCategoryOrder[right.category];
      if (categoryDifference !== 0) {
        return categoryDifference;
      }

      return left.label.localeCompare(right.label);
    });

  const rolePermissionMap = new Map<string, Set<string>>();

  for (const [roleKey, permissionKeys] of Object.entries(DEFAULT_PROJECT_ROLE_PERMISSION_KEYS)) {
    rolePermissionMap.set(roleKey, new Set(permissionKeys));
  }

  const overridesByUserId = new Map<string, { allowPermissionKeys: string[]; denyPermissionKeys: string[] }>();

  for (const row of (memberGrantsData ?? []) as ProjectMemberGrantRow[]) {
    const currentOverrides = overridesByUserId.get(row.user_id) ?? {
      allowPermissionKeys: [],
      denyPermissionKeys: [],
    };

    if (row.override_mode === "deny") {
      currentOverrides.denyPermissionKeys.push(row.permission_key);
    } else {
      currentOverrides.allowPermissionKeys.push(row.permission_key);
    }

    overridesByUserId.set(row.user_id, currentOverrides);
  }

  const members = ((membersData ?? []) as ProjectMembersRow[]).map((member) => {
    const inheritedPermissionKeys = normalizePermissionKeys(
      (member.role_keys ?? []).flatMap((roleKey) => [...(rolePermissionMap.get(roleKey) ?? new Set<string>())]),
    );
    const overrides = overridesByUserId.get(member.user_id) ?? {
      allowPermissionKeys: [],
      denyPermissionKeys: [],
    };
    const allowPermissionKeys = normalizePermissionKeys(overrides.allowPermissionKeys);
    const denyPermissionKeys = normalizePermissionKeys(overrides.denyPermissionKeys);

    return {
      allowPermissionKeys,
      avatarUrl: member.avatar_url,
      denyPermissionKeys,
      effectivePermissionKeys: getEffectivePermissionKeys({
        allowPermissionKeys,
        denyPermissionKeys,
        inheritedPermissionKeys,
      }),
      email: member.email,
      inheritedPermissionKeys,
      joinedAt: member.joined_at,
      name: member.name,
      roles: member.role_keys ?? [],
      userId: member.user_id,
    } satisfies ProjectPermissionMemberRecord;
  });

  return {
    currentUserId,
    members,
    permissions,
  } satisfies ProjectPermissionsPayload;
};

export const GET = withProjectPermissionManagerRoute(async (_request, { projectId, supabase, user }) => {
  try {
    const payload = await loadProjectPermissionsPayload({
      currentUserId: user.id,
      projectId,
      supabase,
    });

    return NextResponse.json(payload satisfies ProjectPermissionsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "permissions");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "permissions") });
  }
});

export const PATCH = withProjectPermissionManagerRoute(async (request, { projectId, supabase, user }) => {
  const payloadResult = await parseJsonBody(request, updateProjectMemberPermissionsSchema, {
    maxBytes: 24 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as UpdateProjectMemberPermissionsPayload;
  const userId = payload.userId?.trim();

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-permissions:patch",
    key: user.id,
    request,
    limit: 20,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const { error } = await supabase.rpc("set_project_member_permission_overrides", {
      p_allow_permission_keys: payload.allowPermissionKeys ?? [],
      p_deny_permission_keys: payload.denyPermissionKeys ?? [],
      p_project_id: projectId,
      p_user_id: userId,
    });

    if (error) {
      if (isControlPlaneSetupError(error)) {
        return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
      }

      const message = getProjectAccessRouteErrorMessage(error, "permissions");
      return NextResponse.json(
        { error: message },
        { status: getProjectAccessRouteErrorStatus(message, "permissions") },
      );
    }

    invalidateControlPlaneRuntimeCache({
      projectId,
    });
    invalidateContentProjectContextCaches(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "permissions");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "permissions") });
  }
});
