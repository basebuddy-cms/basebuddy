import { NextResponse } from "next/server";

import {
  getAuthenticatedApiRequestContext,
  type AuthenticatedApiRequestContext,
} from "@/lib/control-plane/server";
import { getSetupRequiredApiResponse } from "@/lib/api/setup-required";

export const requireAuthenticatedApiUser = async (options?: {
  ensurePreparedProfile?: boolean;
  unauthenticatedMessage?: string;
}) => {
  const setupRequiredResponse = getSetupRequiredApiResponse();

  if (setupRequiredResponse) {
    return {
      account: null,
      errorResponse: setupRequiredResponse,
      supabase: null,
      user: null,
    };
  }

  const authResult = await getAuthenticatedApiRequestContext({
    ensurePreparedProfile: Boolean(options?.ensurePreparedProfile),
  });

  if (!authResult.ok) {
    const errorResult = authResult as Extract<AuthenticatedApiRequestContext, { ok: false }>;
    const errorMessage =
      errorResult.status === 401 && options?.unauthenticatedMessage
        ? options.unauthenticatedMessage
        : errorResult.errorMessage;

    return {
      account: null,
      errorResponse: NextResponse.json(
        { error: errorMessage },
        { status: errorResult.status },
      ),
      supabase: errorResult.supabase,
      user: null,
    };
  }

  return {
    account: authResult.account,
    errorResponse: null,
    supabase: authResult.supabase,
    user: authResult.user,
  };
};

export const requireAuthenticatedApiUserOrRedirect = async (
  redirectUrl: URL,
  options?: {
    ensurePreparedProfile?: boolean;
    unauthenticatedMessage?: string;
  },
) => {
  const authResult = await requireAuthenticatedApiUser(options);

  if (authResult.errorResponse && authResult.errorResponse.status === 401) {
    return {
      ...authResult,
      errorResponse: NextResponse.redirect(redirectUrl),
    };
  }

  return authResult;
};
