import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withAuthenticatedPreparedProjectRoute } from "@/lib/api/project-api-auth";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { parseJsonBody, enforceRateLimit } from "@/lib/api/request-guards";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { invalidateContentProjectContextCaches } from "@/lib/content-runtime/server-project-context";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
  isUniqueViolationError,
} from "@/lib/control-plane/server";
import { normalizeProjectSlug, normalizeProjectWebsiteUrl } from "@/lib/control-plane/utils";

export const runtime = "nodejs";

type UpdateProjectSettingsPayload = {
  currentSlug?: string;
  name?: string;
  slug?: string;
  websiteUrl?: string;
};

type UpdateProjectMetadataRow = {
  id: string;
  name: string;
  slug: string;
  website_url?: string | null;
};

const isMissingProjectWebsiteUrlCompatibilityError = (message: string | null | undefined) =>
  /website_url|p_website_url|update_project_metadata\(uuid, text, text, text\)/i.test(message ?? "");

const updateProjectSettingsSchema = z.object({
  currentSlug: z.string().trim().max(80, "Project address must be 80 characters or fewer.").optional(),
  name: z.string().trim().min(1, "Enter a project name first.").max(120, "Project name must be 120 characters or fewer."),
  slug: z.string().trim().min(1, "Enter a project address first.").max(80, "Project address must be 80 characters or fewer."),
  websiteUrl: z.string().trim().max(2048, "Website URL must be 2048 characters or fewer.").optional(),
});

export const PATCH = withAuthenticatedPreparedProjectRoute(async (request, { projectId, supabase, user }) => {
  const payloadResult = await parseJsonBody(request, updateProjectSettingsSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as UpdateProjectSettingsPayload;
  const projectName = payload.name?.trim() ?? "";
  const projectSlug = normalizeProjectSlug(payload.slug ?? "");
  const currentSlug = normalizeProjectSlug(payload.currentSlug ?? "");
  const normalizedWebsiteUrl = normalizeProjectWebsiteUrl(payload.websiteUrl);

  if (!projectName) {
    return NextResponse.json({ error: "Enter a project name first." }, { status: 400 });
  }

  if (!projectSlug) {
    return NextResponse.json({ error: "Enter a project address first." }, { status: 400 });
  }

  if (payload.websiteUrl?.trim() && !normalizedWebsiteUrl) {
    return NextResponse.json(
      { error: "Enter a valid website URL, like https://example.com." },
      { status: 400 },
    );
  }

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-settings:patch",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  let rpcResult = await supabase.rpc("update_project_metadata", {
    p_name: projectName,
    p_project_id: projectId,
    p_slug: projectSlug,
    p_website_url: normalizedWebsiteUrl,
  });

  if (
    rpcResult.error &&
    (isControlPlaneSetupError(rpcResult.error) || rpcResult.error.code === "PGRST202") &&
    isMissingProjectWebsiteUrlCompatibilityError(rpcResult.error.message)
  ) {
    rpcResult = await supabase.rpc("update_project_metadata", {
      p_name: projectName,
      p_project_id: projectId,
      p_slug: projectSlug,
    });
  }

  const { data, error } = rpcResult;

  if (error) {
    if (isControlPlaneSetupError(error)) {
      return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
    }

    if (isUniqueViolationError(error)) {
      return NextResponse.json({ error: "That project address is already taken." }, { status: 409 });
    }

    if (/not authorized/i.test(error.message ?? "")) {
      return NextResponse.json({ error: "You do not have permission to update this project." }, { status: 403 });
    }

    if (/project not found/i.test(error.message ?? "")) {
      return NextResponse.json({ error: "Could not find that project." }, { status: 404 });
    }

    const message = getProductionErrorMessage(error, "Could not update this project right now.");
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const project = (Array.isArray(data) ? data[0] : data) as UpdateProjectMetadataRow | null;

  if (!project) {
    return NextResponse.json({ error: "Could not update this project right now." }, { status: 500 });
  }

  invalidateControlPlaneRuntimeCache({
    projectId,
  });
  invalidateContentProjectContextCaches(projectId);

  revalidatePath("/projects");

  if (currentSlug) {
    revalidatePath(`/projects/${currentSlug}`);
  }

  revalidatePath(`/projects/${project.slug}`);

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      websiteUrl: project.website_url ?? null,
    },
  });
});

export const DELETE = withAuthenticatedPreparedProjectRoute(async (_request, { projectId, supabase, user }) => {
  const rateLimitError = enforceRateLimit({
    bucket: "api:project-settings:delete",
    key: user.id,
    limit: 5,
    request: _request,
    windowMs: 10 * 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const { error } = await supabase.rpc("delete_project_for_current_user", {
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
    }

    if (/not authorized/i.test(error.message ?? "")) {
      return NextResponse.json({ error: "You do not have permission to delete this project." }, { status: 403 });
    }

    if (/project not found/i.test(error.message ?? "")) {
      return NextResponse.json({ error: "Could not find that project." }, { status: 404 });
    }

    const message = getProductionErrorMessage(error, "Could not delete this project right now.");
    return NextResponse.json({ error: message }, { status: 500 });
  }

  invalidateControlPlaneRuntimeCache({
    projectId,
  });
  invalidateContentProjectContextCaches(projectId);

  revalidatePath("/projects");

  return NextResponse.json({ success: true });
});
