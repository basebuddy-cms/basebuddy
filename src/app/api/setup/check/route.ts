import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceRateLimit, parseJsonBody } from "@/lib/api/request-guards";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";

const setupCheckPayloadSchema = z.object({}).strict();

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const rateLimitError = enforceRateLimit({
    bucket: "api:setup-check",
    key: "setup",
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const payloadResult = await parseJsonBody(request, setupCheckPayloadSchema, {
    maxBytes: 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const status = await getBaseBuddyConfigSetupStatus({
    checkContentDatabase: true,
  });
  const ready = isBaseBuddyConfigSetupReady(status);

  return NextResponse.json({
    ready,
    status,
  });
};
