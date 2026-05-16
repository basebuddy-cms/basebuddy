import { getProductionErrorMessage } from "@/lib/errors/user-facing";

const PROJECT_ACCESS_ROUTE_DEFAULT_MESSAGES = {
  authors: "Could not manage project authors right now.",
  members: "Could not manage project members right now.",
  permissions: "Could not manage project permissions right now.",
} as const;

type ProjectAccessRouteErrorKind = keyof typeof PROJECT_ACCESS_ROUTE_DEFAULT_MESSAGES;

const PROJECT_ACCESS_ROUTE_STATUS_PATTERNS = {
  authors: {
    badRequest: /Name is required|Select an entry first/i,
    conflict: null,
    forbidden: /not authorized|do not have permission/i,
    notFound: /project member not found|Select a content author first|Select a project member with the author role/i,
  },
  members: {
    badRequest: /email is required|select at least one role|author scope|cms author|invitation token|invitation expiry|invited email address/i,
    conflict: /already a member|at least one owner|pending invitation|already been accepted|already been revoked|already expired/i,
    forbidden: /not authorized/i,
    notFound: /project member not found|needs to sign in|project invitation not found/i,
  },
  permissions: {
    badRequest: /invalid permission|cannot be both allowed and denied/i,
    conflict: /at least one member must keep permission to manage members/i,
    forbidden: /not authorized|do not have permission/i,
    notFound: /project member not found/i,
  },
} as const;

export const getProjectAccessRouteErrorMessage = (
  error: unknown,
  kind: ProjectAccessRouteErrorKind,
) => getProductionErrorMessage(error, PROJECT_ACCESS_ROUTE_DEFAULT_MESSAGES[kind]);

export const getProjectAccessRouteErrorStatus = (
  message: string,
  kind: ProjectAccessRouteErrorKind,
) => {
  if (/Authentication required|Please sign in to continue/i.test(message)) {
    return 401;
  }

  const patterns = PROJECT_ACCESS_ROUTE_STATUS_PATTERNS[kind];

  if (patterns.forbidden?.test(message)) {
    return 403;
  }

  if (patterns.notFound?.test(message)) {
    return 404;
  }

  if (patterns.badRequest?.test(message)) {
    return 400;
  }

  if (patterns.conflict?.test(message)) {
    return 409;
  }

  return 500;
};
