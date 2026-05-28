import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateBaseBuddyConfigUser } from "@/lib/basebuddy-config/auth";
import { appendBaseBuddyAuditEvent } from "@/lib/basebuddy-config/audit-log";
import {
  getBaseBuddyLoginBackoffDecision,
  recordBaseBuddyLoginFailure,
  recordBaseBuddyLoginSuccess,
} from "@/lib/basebuddy-config/login-protection";
import { createLocalAuthenticatedSession } from "@/lib/auth/local-auth";
import { enforceRateLimit, getClientIp, parseJsonBody } from "@/lib/api/request-guards";
import { getSetupRequiredApiResponse } from "@/lib/api/setup-required";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const setupRequiredResponse = await getSetupRequiredApiResponse();

  if (setupRequiredResponse) {
    return setupRequiredResponse;
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:auth:login",
    key: request.headers.get("x-forwarded-for") ?? "local",
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const payloadResult = await parseJsonBody(request, loginSchema, {
    maxBytes: 8 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const email = payloadResult.data.email.trim().toLowerCase();
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const backoffDecision = getBaseBuddyLoginBackoffDecision({
    email,
    ipAddress,
  });

  if (!backoffDecision.allowed) {
    return NextResponse.json(
      { error: "Too many failed sign-in attempts. Please wait a few minutes and try again." },
      {
        headers: {
          "Retry-After": String(backoffDecision.retryAfterSeconds),
        },
        status: 429,
      },
    );
  }

  const user = await authenticateBaseBuddyConfigUser({
    email,
    password: payloadResult.data.password,
  });

  if (!user) {
    recordBaseBuddyLoginFailure({
      email,
      ipAddress,
    });
    await appendBaseBuddyAuditEvent({
      actorEmail: email,
      ipAddress,
      type: "auth.login.failure",
      userAgent,
    });

    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  recordBaseBuddyLoginSuccess({
    email,
    ipAddress,
  });

  const response = NextResponse.json({ ok: true });

  await createLocalAuthenticatedSession({
    cookies: response.cookies,
    request,
    userId: user.id,
  });
  await appendBaseBuddyAuditEvent({
    actorEmail: user.email,
    actorUserId: user.id,
    ipAddress,
    type: "auth.login.success",
    userAgent,
  });

  return response;
}
