import { NextResponse } from "next/server";

import {
  getAuthenticatedApiRequestContext,
  type AuthenticatedApiRequestContext,
} from "@/lib/control-plane/server";
import { enforceSameOriginRequest } from "@/lib/api/request-guards";
import { getSetupRequiredApiResponse } from "@/lib/api/setup-required";

export const requireAuthenticatedProjectApiUser = async (options?: {
  ensurePreparedProfile?: boolean;
}) => {
  const setupRequiredResponse = getSetupRequiredApiResponse();

  if (setupRequiredResponse) {
    return {
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
    return {
      errorResponse: NextResponse.json(
        { error: errorResult.errorMessage },
        { status: errorResult.status },
      ),
      supabase: errorResult.supabase,
      user: null,
    };
  }

  return {
    errorResponse: null,
    supabase: authResult.supabase,
    user: authResult.user,
  };
};

export const requireAuthenticatedPreparedProjectApiUser = async () =>
  requireAuthenticatedProjectApiUser({
    ensurePreparedProfile: true,
  });

type ProjectRouteParams = {
  projectId: string;
};

export type AuthenticatedProjectApiRouteContext = {
  projectId: string;
  supabase: NonNullable<Awaited<ReturnType<typeof requireAuthenticatedProjectApiUser>>["supabase"]>;
  user: NonNullable<Awaited<ReturnType<typeof requireAuthenticatedProjectApiUser>>["user"]>;
};

type AuthenticatedProjectAccessRouteResult<TContext extends object> =
  | {
      context: TContext;
      errorResponse: null;
    }
  | {
      context: null;
      errorResponse: Response;
    };

export const withAuthenticatedProjectRoute = <TResponse extends Response | Promise<Response>>(
  handler: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext,
  ) => TResponse,
  options?: {
    ensurePreparedProfile?: boolean;
  },
) => {
  return async (
    request: Request,
    routeContext: { params: Promise<ProjectRouteParams> },
  ) => {
    const { projectId } = await routeContext.params;
    const authResult = await requireAuthenticatedProjectApiUser(options);

    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const sameOriginError = enforceSameOriginRequest(request);

    if (sameOriginError) {
      return sameOriginError;
    }

    return handler(request, {
      projectId,
      supabase: authResult.supabase,
      user: authResult.user,
    });
  };
};

export const withAuthenticatedPreparedProjectRoute = <TResponse extends Response | Promise<Response>>(
  handler: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext,
  ) => TResponse,
) =>
  withAuthenticatedProjectRoute(handler, {
    ensurePreparedProfile: true,
  });

export const withAuthenticatedProjectAccessRoute = <TAccessContext extends object>(
  resolveAccess: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext,
  ) => Promise<AuthenticatedProjectAccessRouteResult<TAccessContext>>,
  handler: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext & TAccessContext,
  ) => Response | Promise<Response>,
  options?: {
    ensurePreparedProfile?: boolean;
  },
) =>
  withAuthenticatedProjectRoute(async (request, context) => {
    const accessResult = await resolveAccess(request, context);

    if (accessResult.errorResponse) {
      return accessResult.errorResponse;
    }

    return await handler(request, {
      ...context,
      ...accessResult.context,
    });
  }, options);

export const withAuthenticatedPreparedProjectAccessRoute = <TAccessContext extends object>(
  resolveAccess: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext,
  ) => Promise<AuthenticatedProjectAccessRouteResult<TAccessContext>>,
  handler: (
    request: Request,
    context: AuthenticatedProjectApiRouteContext & TAccessContext,
  ) => Response | Promise<Response>,
) =>
  withAuthenticatedProjectAccessRoute(resolveAccess, handler, {
    ensurePreparedProfile: true,
  });
