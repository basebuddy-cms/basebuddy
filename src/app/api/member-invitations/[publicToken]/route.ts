import { NextResponse } from "next/server";

import { requireAuthenticatedApiUser } from "@/lib/api/api-auth";
import { enforceRateLimit, enforceSameOriginRequest } from "@/lib/api/request-guards";
import type { AcceptProjectMemberInvitationResult } from "@/lib/control-plane/member-invitations";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { invalidateContentProjectContextCaches } from "@/lib/content-runtime/server-project-context";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/server";

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

type AcceptProjectMemberInvitationRow = {
  membership_status: "accepted" | "already_member";
  project_id: string;
  project_slug: string;
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
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("accept_project_member_invitation", {
      p_public_token: normalizedToken,
    });

    if (error) {
      logProjectMemberInvitationAcceptRouteError("accept", error, {
        publicTokenSuffix: normalizedToken.slice(-6),
      });

      const message = getProductionErrorMessage(error, "Could not accept this invitation right now.");
      return NextResponse.json({ error: message }, { status: getInvitationAcceptStatus(message) });
    }

    const invitation = ((Array.isArray(data) ? data[0] : data) ?? null) as AcceptProjectMemberInvitationRow | null;

    if (!invitation?.project_id || !invitation.project_slug || !invitation.membership_status) {
      return NextResponse.json({ error: "Could not accept this invitation right now." }, { status: 500 });
    }

    invalidateControlPlaneRuntimeCache({
      projectId: invitation.project_id,
    });
    invalidateContentProjectContextCaches(invitation.project_id);

    return NextResponse.json({
      redirectTo: `/projects/${invitation.project_slug}`,
      status: invitation.membership_status,
    } satisfies AcceptProjectMemberInvitationResult);
  } catch (error) {
    logProjectMemberInvitationAcceptRouteError("accept:unhandled", error, {
      publicTokenSuffix: normalizedToken.slice(-6),
    });

    const message = getProductionErrorMessage(error, "Could not accept this invitation right now.");
    return NextResponse.json({ error: message }, { status: getInvitationAcceptStatus(message) });
  }
};
