import { NextResponse } from "next/server";

import {
  withAuthenticatedPreparedProjectRoute,
} from "@/lib/api/project-api-auth";
import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";
import { enforceRateLimit } from "@/lib/api/request-guards";
import {
  type ProjectMemberInvitationsPayload,
} from "@/lib/control-plane/member-invitations";
import {
  listConfigProjectMemberInvitations,
  revokeConfigProjectMemberInvitation,
} from "@/lib/basebuddy-config/projects";

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

const loadProjectMemberInvitationsPayload = async ({
  actorUserId,
  projectId,
}: {
  actorUserId: string;
  projectId: string;
}) => {
  return listConfigProjectMemberInvitations({
    actorUserId,
    page: 1,
    pageSize: PROJECT_INVITATIONS_PAGE_SIZE,
    projectId,
  });
};

export const DELETE = withAuthenticatedPreparedProjectRoute(
  async (request, { projectId, user }) => {
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
      await revokeConfigProjectMemberInvitation({
        actorUserId: user.id,
        invitationId,
        projectId,
      });

      const refreshedPayload = await loadProjectMemberInvitationsPayload({
        actorUserId: user.id,
        projectId,
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
