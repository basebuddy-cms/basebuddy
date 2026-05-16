import { NextResponse } from "next/server";
import { z } from "zod";

import { withAuthenticatedPreparedProjectRoute } from "@/lib/api/project-api-auth";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { enforceRateLimit, parseJsonBody } from "@/lib/api/request-guards";
import {
  getProjectPostSidebarConfig,
  projectPostSidebarConfigSourceValues,
  saveProjectPostSidebarConfig,
} from "@/lib/control-plane/project-post-sidebar-config";
import {
  normalizeContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";
import {
  invalidateProjectRuntimeCacheGroups,
  projectRuntimeCacheGroups,
} from "@/lib/content-runtime/server-runtime-cache";

export const runtime = "nodejs";

const updateProjectPostSidebarConfigSchema = z.object({
  postSidebarConfig: z.object({}).passthrough(),
  source: z.enum(projectPostSidebarConfigSourceValues).optional(),
});

export const GET = withAuthenticatedPreparedProjectRoute(async (_request, { projectId, user }) => {
  const rateLimitError = enforceRateLimit({
    bucket: "api:project-sidebar-fields:get",
    key: user.id,
    limit: 60,
    request: _request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const postSidebarConfig = await getProjectPostSidebarConfig(projectId);
    return NextResponse.json({ postSidebarConfig });
  } catch (error) {
    const message = getProductionErrorMessage(error, "Could not load the sidebar fields for this project.");

    if (/not authorized/i.test(message)) {
      return NextResponse.json({ error: "You do not have permission to view these sidebar fields." }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const PUT = withAuthenticatedPreparedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, updateProjectPostSidebarConfigSchema, {
    maxBytes: 64 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-sidebar-fields:put",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const payload = payloadResult.data;
    const postSidebarConfig = await saveProjectPostSidebarConfig({
      config: normalizeContentPostSidebarConfig(payload.postSidebarConfig),
      projectId,
      source: payload.source,
    });

    invalidateProjectRuntimeCacheGroups(projectId, [projectRuntimeCacheGroups.workspaceMeta]);

    return NextResponse.json({ postSidebarConfig });
  } catch (error) {
    const message = getProductionErrorMessage(error, "Could not save the sidebar fields for this project.");

    if (/not authorized/i.test(message)) {
      return NextResponse.json({ error: "You do not have permission to update these sidebar fields." }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
