import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedApiUser } from "@/lib/api/api-auth";
import {
  enforceRateLimit,
  enforceSameOriginRequest,
  parseJsonBody,
} from "@/lib/api/request-guards";
import {
  ConfigProjectSlugConflictError,
  createConfigProject,
} from "@/lib/basebuddy-config/projects";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { normalizeProjectSlug } from "@/lib/control-plane/utils";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";

type CreateProjectPayload = {
  projectName?: string;
  projectSlug?: string;
};

const createProjectPayloadSchema = z.object({
  projectName: z
    .string()
    .trim()
    .min(1, "Enter a project name first.")
    .max(120, "Project name must be 120 characters or fewer."),
  projectSlug: z
    .string()
    .trim()
    .min(1, "Enter a unique project address first.")
    .max(80, "Project address must be 80 characters or fewer."),
});

export async function POST(request: Request) {
  const sameOriginError = enforceSameOriginRequest(request);

  if (sameOriginError) {
    return sameOriginError;
  }

  const payloadResult = await parseJsonBody(request, createProjectPayloadSchema, {
    maxBytes: 8 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data as CreateProjectPayload;
  const projectName = payload.projectName?.trim() ?? "";
  const projectSlug = normalizeProjectSlug(payload.projectSlug ?? "");

  if (!projectName) {
    return NextResponse.json({ error: "Enter a project name first." }, { status: 400 });
  }

  if (!projectSlug) {
    return NextResponse.json({ error: "Enter a unique project address first." }, { status: 400 });
  }

  const authResult = await requireAuthenticatedApiUser({
    ensurePreparedProfile: true,
  });

  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { user } = authResult;
  const rateLimitError = enforceRateLimit({
    bucket: "api:projects:post",
    key: user.id,
    limit: 5,
    request,
    windowMs: 30 * 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    await createConfigProject({
      name: projectName,
      slug: projectSlug,
      userId: user.id,
    });

    invalidateControlPlaneRuntimeCache({
      groups: ["project-bootstrap", "projects-list"],
      userId: user.id,
    });

    revalidatePath("/projects");

    return NextResponse.json({
      redirectTo: `/projects/${projectSlug}`,
    });
  } catch (error) {
    if (error instanceof ConfigProjectSlugConflictError) {
      return NextResponse.json(
        {
          error: "That project address is already taken. Choose another address and try again.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: getProductionErrorMessage(error, "Could not create the project right now."),
      },
      { status: 500 },
    );
  }
}
