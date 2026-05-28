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
  type ProjectPermissionsPayload,
  type UpdateProjectMemberPermissionsPayload,
} from "@/lib/control-plane/member-permissions";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { parseJsonBody, enforceRateLimit } from "@/lib/api/request-guards";
import { invalidateContentProjectContextCaches } from "@/lib/content-runtime/server-project-context";
import {
  listConfigProjectPermissionMembers,
  setConfigProjectMemberPermissionOverrides,
} from "@/lib/basebuddy-config/projects";

export const runtime = "nodejs";

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

const getProjectPermissionManagerAccess = (context: AuthenticatedProjectApiRouteContext) => {
  const currentRoles = context.memberAccess.roles;
  const currentPermissions = context.memberAccess.permissions;
  const canManagePermissions =
    (currentRoles.includes("owner") || currentRoles.includes("admin")) &&
    currentPermissions.includes("member.manage");

  if (!canManagePermissions) {
    return {
      errorResponse: NextResponse.json(
        { error: "Only project owners and admins can manage member permissions." },
        { status: 403 },
      ),
    };
  }

  return {
    errorResponse: null,
  };
};

const withProjectPermissionManagerRoute = <TResponse extends Response | Promise<Response>>(
  handler: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext,
  ) => TResponse,
) =>
  withAuthenticatedPreparedProjectAccessRoute(
    async (_request, context) => {
      const accessResult = getProjectPermissionManagerAccess(context);

      if (accessResult.errorResponse) {
        return {
          context: null,
          errorResponse: accessResult.errorResponse,
        };
      }

      return {
        context: {},
        errorResponse: null,
      };
    },
    handler,
  );

const loadProjectPermissionsPayload = async ({
  currentUserId,
  projectId,
}: {
  currentUserId: string;
  projectId: string;
}) => {
  return listConfigProjectPermissionMembers({
    currentUserId,
    projectId,
  });
};

export const GET = withProjectPermissionManagerRoute(async (_request, { projectId, user }) => {
  try {
    const payload = await loadProjectPermissionsPayload({
      currentUserId: user.id,
      projectId,
    });

    return NextResponse.json(payload satisfies ProjectPermissionsPayload);
  } catch (error) {
    const message = getProjectAccessRouteErrorMessage(error, "permissions");
    return NextResponse.json({ error: message }, { status: getProjectAccessRouteErrorStatus(message, "permissions") });
  }
});

export const PATCH = withProjectPermissionManagerRoute(async (request, { projectId, user }) => {
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
    await setConfigProjectMemberPermissionOverrides({
      actorUserId: user.id,
      allowPermissionKeys: payload.allowPermissionKeys ?? [],
      denyPermissionKeys: payload.denyPermissionKeys ?? [],
      projectId,
      userId,
    });

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
