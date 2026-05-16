import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceRateLimit, parseJsonBody } from "@/lib/api/request-guards";
import {
  getAuthEndpointSetupSection,
  getControlPlaneSchemaSetupSection,
  getDatabaseConnectionSetupSections,
  getInstallSetupStatus,
  isInstallSetupReady,
} from "@/lib/self-host/install-runtime";

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

  const [
    controlPlaneSchemaSection,
    authEndpointSection,
    databaseConnectionSections,
  ] = await Promise.all([
    getControlPlaneSchemaSetupSection(),
    getAuthEndpointSetupSection(),
    getDatabaseConnectionSetupSections(),
  ]);
  const status = getInstallSetupStatus({
    additionalSections: [
      authEndpointSection,
      ...databaseConnectionSections,
    ],
    controlPlaneSchemaSection,
  });
  const ready = isInstallSetupReady(status);

  if (ready) {
    return NextResponse.json({ ready: true });
  }

  return NextResponse.json({
    ready,
    status,
  });
};
