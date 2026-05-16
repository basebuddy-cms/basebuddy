import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getProductionValidationMessage,
  userFacingErrorMessages,
} from "@/lib/errors/user-facing";
import {
  consumeFixedWindowRateLimit,
  type FixedWindowRateLimitDecision,
} from "@/lib/security/rate-limit";

export const DEFAULT_JSON_MAX_BYTES = 64 * 1024;

const STATE_CHANGING_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);

type RateLimitArgs = {
  bucket: string;
  key?: string | null;
  limit: number;
  request: Request;
  windowMs: number;
};

type JsonParseSuccess<T> = {
  data: T;
  errorResponse: null;
};

type JsonParseFailure = {
  data: null;
  errorResponse: NextResponse;
};

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor?.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    request.headers.get("cf-connecting-ip")?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    null
  );
};

const getRateLimitKey = ({ bucket, key, request }: Pick<RateLimitArgs, "bucket" | "key" | "request">) =>
  `${bucket}:${key?.trim() || getClientIp(request) || "anonymous"}`;

const getRateLimitHeaders = (decision: FixedWindowRateLimitDecision) => ({
  "Retry-After": String(decision.retryAfterSeconds),
  "X-RateLimit-Limit": String(decision.limit),
  "X-RateLimit-Remaining": String(decision.remaining),
  "X-RateLimit-Reset": String(Math.floor(decision.resetAt / 1000)),
});

const getFirstZodIssue = (error: z.ZodError) => {
  const issue = error.issues[0];

  if (!issue) {
    return userFacingErrorMessages.invalidRequest;
  }

  return getProductionValidationMessage(issue.message);
};

const getExpectedRequestOrigin = (request: Request) => {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = request.headers.get("host")?.trim() || forwardedHost;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const url = new URL(request.url);
  const protocol = forwardedProto ? `${forwardedProto.replace(/:$/, "")}:` : url.protocol;

  return `${protocol}//${host || url.host}`;
};

const getSourceOrigin = (request: Request) => {
  const origin = request.headers.get("origin")?.trim();

  if (origin) {
    return origin;
  }

  const referer = request.headers.get("referer")?.trim();

  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

export const enforceSameOriginRequest = (request: Request) => {
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  if (!request.headers.get("cookie")?.trim()) {
    return null;
  }

  const sourceOrigin = getSourceOrigin(request);
  const expectedOrigin = getExpectedRequestOrigin(request);

  if (sourceOrigin === expectedOrigin) {
    return null;
  }

  return NextResponse.json(
    { error: "We couldn't verify this request. Refresh the page and try again." },
    { status: 403 },
  );
};

export const enforceRateLimit = ({
  bucket,
  key,
  limit,
  request,
  windowMs,
}: RateLimitArgs) => {
  const decision = consumeFixedWindowRateLimit({
    key: getRateLimitKey({ bucket, key, request }),
    limit,
    windowMs,
  });

  if (decision.allowed) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: getRateLimitHeaders(decision),
    },
  );
};

export const enforceContentLength = ({
  label = "Request body",
  maxBytes,
  request,
}: {
  label?: string;
  maxBytes: number;
  request: Request;
}) => {
  const rawValue = request.headers.get("content-length");
  const contentLength = Number.parseInt(rawValue ?? "", 10);

  if (!Number.isFinite(contentLength) || contentLength <= maxBytes) {
    return null;
  }

  return NextResponse.json(
    { error: `${label} is too large.` },
    { status: 413 },
  );
};

export const parseJsonBody = async <T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
  {
    maxBytes = DEFAULT_JSON_MAX_BYTES,
  }: {
    maxBytes?: number;
  } = {},
): Promise<JsonParseSuccess<z.infer<T>> | JsonParseFailure> => {
  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    return {
      data: null,
      errorResponse: NextResponse.json(
        { error: userFacingErrorMessages.uploadTooLarge },
        { status: 413 },
      ),
    };
  }

  let parsedBody: unknown = {};

  if (rawBody.trim()) {
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      return {
        data: null,
        errorResponse: NextResponse.json(
          { error: userFacingErrorMessages.requestProcessing },
          { status: 400 },
        ),
      };
    }
  }

  const result = schema.safeParse(parsedBody);

  if (!result.success) {
    return {
      data: null,
      errorResponse: NextResponse.json(
        { error: getFirstZodIssue(result.error) },
        { status: 400 },
      ),
    };
  }

  return {
    data: result.data,
    errorResponse: null,
  };
};
