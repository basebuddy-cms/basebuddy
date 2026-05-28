import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceRateLimit, parseJsonBody } from "@/lib/api/request-guards";
import { createInitialBaseBuddySetup } from "@/lib/basebuddy-config/initial-setup";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";

const setupCreatePayloadSchema = z
  .object({
    ownerEmail: z.string().trim().min(1).max(320),
    ownerName: z.string().trim().min(1).max(160),
    ownerPassword: z.string().min(1).max(256),
  })
  .strict();

export const runtime = "nodejs";

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

const enforceSetupOrigin = (request: Request) => {
  const sourceOrigin = getSourceOrigin(request);

  if (!sourceOrigin) {
    return null;
  }

  if (sourceOrigin === getExpectedRequestOrigin(request)) {
    return null;
  }

  return NextResponse.json(
    { error: "We couldn't verify this setup request. Refresh the page and try again." },
    { status: 403 },
  );
};

const getSetupErrorStatus = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Could not create BaseBuddy setup.";

  if (/already has an owner user/i.test(message)) {
    return {
      message,
      status: 409,
    };
  }

  return {
    message,
    status: 400,
  };
};

export const POST = async (request: Request) => {
  const originError = enforceSetupOrigin(request);

  if (originError) {
    return originError;
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:setup-create",
    key: "setup",
    limit: 10,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const payloadResult = await parseJsonBody(request, setupCreatePayloadSchema, {
    maxBytes: 8 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  try {
    await createInitialBaseBuddySetup({
      owner: {
        email: payloadResult.data.ownerEmail,
        name: payloadResult.data.ownerName,
        password: payloadResult.data.ownerPassword,
      },
    });
  } catch (error) {
    const { message, status } = getSetupErrorStatus(error);

    return NextResponse.json({ error: message }, { status });
  }

  const status = await getBaseBuddyConfigSetupStatus({
    checkContentDatabase: false,
  });

  return NextResponse.json({
    ready: isBaseBuddyConfigSetupReady(status),
    status,
  });
};
