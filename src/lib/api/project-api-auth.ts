import { NextResponse } from "next/server";

import {
  getAuthenticatedApiRequestContext,
  type AuthenticatedApiRequestContext,
} from "@/lib/control-plane/server";
import type { AuthenticatedUserAccount } from "@/lib/control-plane/server";
import { enforceSameOriginRequest } from "@/lib/api/request-guards";
import { getSetupRequiredApiResponse } from "@/lib/api/setup-required";
import {
  getConfigProjectAccessContext,
  type ConfigProjectSummary,
} from "@/lib/basebuddy-config/projects";
import type { ProjectMemberAccess } from "@/lib/control-plane/permissions";

export const requireAuthenticatedProjectApiUser = async (options?: {
  ensurePreparedProfile?: boolean;
}) => {
  const setupRequiredResponse = await getSetupRequiredApiResponse();

  if (setupRequiredResponse) {
    return {
      account: null,
      errorResponse: setupRequiredResponse,
      user: null,
    };
  }

  const authResult = await getAuthenticatedApiRequestContext({
    ensurePreparedProfile: Boolean(options?.ensurePreparedProfile),
  });

  if (!authResult.ok) {
    const errorResult = authResult as Extract<AuthenticatedApiRequestContext, { ok: false }>;
    return {
      account: null,
      errorResponse: NextResponse.json(
        { error: errorResult.errorMessage },
        { status: errorResult.status },
      ),
      user: null,
    };
  }

  return {
    account: authResult.account,
    errorResponse: null,
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
  account: AuthenticatedUserAccount;
  memberAccess: ProjectMemberAccess;
  project: ConfigProjectSummary;
  projectId: string;
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

    const projectAccess = await getConfigProjectAccessContext({
      projectId,
      userId: authResult.user.id,
    });

    if (!projectAccess) {
      return NextResponse.json({ error: "Could not find that project." }, { status: 404 });
    }

    if (!projectAccess.memberAccess.permissions.includes("project.read")) {
      return NextResponse.json(
        { error: "You do not have permission to access this project." },
        { status: 403 },
      );
    }

    return handler(request, {
      account: authResult.account,
      memberAccess: projectAccess.memberAccess,
      project: projectAccess.project,
      projectId,
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
