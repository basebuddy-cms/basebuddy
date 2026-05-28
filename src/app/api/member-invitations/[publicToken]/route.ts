import { NextResponse } from "next/server";

import { requireAuthenticatedApiUser } from "@/lib/api/api-auth";
import { enforceRateLimit, enforceSameOriginRequest } from "@/lib/api/request-guards";
import type { AcceptProjectMemberInvitationResult } from "@/lib/control-plane/member-invitations";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { invalidateContentProjectContextCaches } from "@/lib/content-runtime/server-project-context";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { acceptConfigProjectMemberInvitation } from "@/lib/basebuddy-config/projects";

export const runtime = "nodejs";

const logProjectMemberInvitationAcceptRouteError = (
  operation: string,
  error: unknown,
  metadata: Record<string, string | null | undefined> = {},
) => {
  console.error("[project-member-invitation-accept-route]", {
    error,
    ...metadata,
    operation,
  });
};

const getInvitationAcceptStatus = (message: string) => {
  if (/Authentication required|Please sign in to continue/i.test(message)) {
    return 401;
  }

  if (/not found/i.test(message)) {
    return 404;
  }

  if (/Sign in with the invited email/i.test(message)) {
    return 403;
  }

  if (/expired|revoked|already been accepted/i.test(message)) {
    return 409;
  }

  return 400;
};

export const POST = async (
  request: Request,
  routeContext: { params: Promise<{ publicToken: string }> },
) => {
  const sameOriginError = enforceSameOriginRequest(request);

  if (sameOriginError) {
    return sameOriginError;
  }

  const authResult = await requireAuthenticatedApiUser({
    ensurePreparedProfile: true,
    unauthenticatedMessage: "Sign in with the invited email address to accept this invitation.",
  });

  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:member-invitation-accept:post",
    key: authResult.user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const { publicToken } = await routeContext.params;
  const normalizedToken = publicToken.trim();

  if (!normalizedToken) {
    return NextResponse.json({ error: "Project invitation not found." }, { status: 404 });
  }

  try {
    const invitation = await acceptConfigProjectMemberInvitation({
      publicToken: normalizedToken,
      userEmail: authResult.account?.email ?? authResult.user.email ?? null,
      userId: authResult.user.id,
    });

    invalidateControlPlaneRuntimeCache({
      projectId: invitation.projectId,
    });
    invalidateContentProjectContextCaches(invitation.projectId);

    return NextResponse.json({
      redirectTo: invitation.redirectTo,
      status: invitation.status,
    } satisfies AcceptProjectMemberInvitationResult);
  } catch (error) {
    logProjectMemberInvitationAcceptRouteError("accept:unhandled", error, {
      publicTokenSuffix: normalizedToken.slice(-6),
    });

    const message = getProductionErrorMessage(error, "Could not accept this invitation right now.");
    return NextResponse.json({ error: message }, { status: getInvitationAcceptStatus(message) });
  }
};
