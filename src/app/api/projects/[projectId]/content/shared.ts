import { NextResponse } from "next/server";

import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { requireAuthenticatedProjectApiUser } from "@/lib/api/project-api-auth";
import {
  getContentPlaneDegradedDatabaseMessage,
  isContentPlaneDatabaseTimeoutLikeError,
} from "@/lib/content-runtime/content-plane-db-resilience";
import {
  getContentAdapterOperationErrorStatus,
  isContentAdapterOperationError,
} from "@/lib/content-runtime/adapter/error-mapping";
import {
  type ContentRuntimeRequestMetricValue,
  getContentRuntimeRequestMetricsSnapshot,
  getContentRuntimeRequestServerTimingHeader,
  logSlowContentRuntimeRequest,
  pushContentRuntimeRequestSpan,
  runWithContentRuntimeRequestMetrics,
  setContentRuntimeRequestMetric,
  measureContentRuntimeRequestSpan,
} from "@/lib/content-runtime/request-observability";

const getUnknownErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Could not process the content request right now.";
};

export const getContentRouteErrorMessage = (error: unknown) => {
  if (isContentAdapterOperationError(error)) {
    return error.errors[0]?.message ?? "Could not process the content request right now.";
  }

  const message = getUnknownErrorMessage(error);

  if (/MaxClientsInSessionMode|max clients reached/i.test(message)) {
    return "BaseBuddy is busy right now. Try again in a few seconds.";
  }

  if (/Circuit breaker open: Too many authentication errors/i.test(message)) {
    return "The app connection is temporarily unavailable. Wait a moment and try again.";
  }

  if (/password authentication failed|Tenant or user not found/i.test(message)) {
    return "The app connection is no longer valid. Update setup and try again.";
  }

  if (isContentPlaneDatabaseTimeoutLikeError(message)) {
    return getContentPlaneDegradedDatabaseMessage();
  }

  const pgError = error as { code?: string; column?: string };

  if (pgError.code === "23502") {
    return "A required field is missing. Please check your input and try again.";
  }

  if (pgError.code === "22P02" || pgError.code === "22003" || pgError.code === "22007") {
    return "One or more fields have invalid values. Please review your input and try again.";
  }

  if (pgError.code === "22001") {
    return "One or more fields are too long. Please shorten them and try again.";
  }

  if (pgError.code === "23514") {
    return "One or more fields have invalid values. Please review your input and try again.";
  }

  if (pgError.code === "42P01") {
    return "This project's content setup is out of date. Review the setup and try again.";
  }

  if (pgError.code === "42703") {
    return "This project's content setup is out of date. Review the setup and try again.";
  }

  return getProductionErrorMessage(message, "Could not process the content request right now.");
};

export const getContentRouteErrorStatus = (message: string) =>
  /Authentication required|Please sign in to continue|Could not load this project/i.test(message)
    ? 401
    : /do not have permission|not authorized/i.test(message)
      ? 403
      : /Could not find that post/i.test(message)
        ? 404
        : /temporarily switched this project into a degraded state|responding too slowly|having trouble reaching this project's content right now/i.test(message)
          ? 503
          : /Select a post|requires Session Pooler|content setup is out of date|field ".+" is required|invalid type|too long|does not satisfy the database constraints/i.test(
              message,
            )
          ? 400
          : 500;

export const getContentRouteErrorResponse = (error: unknown) => {
  const message = getContentRouteErrorMessage(error);

  if (isContentAdapterOperationError(error)) {
    return NextResponse.json(
      {
        error: message,
        errors: error.errors,
      },
      { status: getContentAdapterOperationErrorStatus(error.errors) },
    );
  }

  return NextResponse.json(
    { error: message },
    { status: getContentRouteErrorStatus(message) },
  );
};

export const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const applyContentRuntimeRequestMetadata = ({
  endpoint,
  metadata,
}: {
  endpoint: string;
  metadata?: Record<string, ContentRuntimeRequestMetricValue>;
}) => {
  setContentRuntimeRequestMetric("scopeKey", endpoint);
  setContentRuntimeRequestMetric("cacheState", "unknown");

  for (const [key, value] of Object.entries(metadata ?? {})) {
    setContentRuntimeRequestMetric(key, value);
  }
};

const finalizeContentTimedResponse = ({
  endpoint,
  projectId,
  response,
}: {
  endpoint: string;
  projectId: string;
  response: Response;
}) => {
  const snapshot = getContentRuntimeRequestMetricsSnapshot();
  response.headers.set("Server-Timing", getContentRuntimeRequestServerTimingHeader());

  if (snapshot) {
    logSlowContentRuntimeRequest({
      cacheState:
        (snapshot.metadata.cacheState as
          | "fresh"
          | "missing"
          | "stale"
          | "uncached"
          | "unknown"
          | undefined) ?? "unknown",
      durationMs: snapshot.totalDurationMs,
      endpoint,
      mode: (snapshot.metadata.cmsSetupPath as string | null | undefined) ?? null,
      projectId,
      scopeKey: String(snapshot.metadata.scopeKey ?? endpoint),
      spans: snapshot.spans,
      status: response.status,
    });
  }

  return response;
};

export const runTimedAuthenticatedContentGetRoute = async <T>({
  authResult,
  authDurationMs,
  endpoint,
  handler,
  metadata,
  projectId,
}: {
  authResult?: Awaited<ReturnType<typeof requireAuthenticatedProjectApiUser>>;
  authDurationMs?: number;
  endpoint: string;
  handler: () => Promise<T>;
  metadata?: Record<string, ContentRuntimeRequestMetricValue>;
  projectId: string;
}) => {
  return runWithContentRuntimeRequestMetrics({
    endpoint,
    projectId,
    work: async () => {
      applyContentRuntimeRequestMetadata({
        endpoint,
        metadata,
      });

      if (typeof authDurationMs === "number" && Number.isFinite(authDurationMs)) {
        pushContentRuntimeRequestSpan("auth", authDurationMs);
      }

      if (authResult?.errorResponse || authResult?.user === null) {
        const response = authResult.errorResponse!;
        return finalizeContentTimedResponse({
          endpoint,
          projectId,
          response,
        });
      }

      try {
        const payload = await measureContentRuntimeRequestSpan("handler", handler);
        const response = NextResponse.json(payload);
        return finalizeContentTimedResponse({
          endpoint,
          projectId,
          response,
        });
      } catch (error) {
        console.error(`[content-runtime-route][${endpoint}]`, {
          error,
          projectId,
        });
        const response = getContentRouteErrorResponse(error);
        return finalizeContentTimedResponse({
          endpoint,
          projectId,
          response,
        });
      }
    },
  });
};
