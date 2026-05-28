import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedApiUser } from "@/lib/api/api-auth";
import { updateBaseBuddyConfigUserProfile } from "@/lib/basebuddy-config/auth";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import { getUserDisplayName } from "@/lib/control-plane/utils";
import {
  enforceRateLimit,
  enforceSameOriginRequest,
  parseJsonBody,
} from "@/lib/api/request-guards";

export const runtime = "nodejs";

const profileNameSchema = z.object({
  name: z.string().trim().min(1, "Enter a profile name first.").max(120, "Profile name must be 120 characters or fewer."),
});

const profileUpdateSchema = profileNameSchema.extend({
  avatarUrl: z.string().trim().url("Avatar URL must be valid.").max(2_000, "Avatar URL is too long.").nullable().optional(),
});

export async function PATCH(request: Request) {
  const sameOriginError = enforceSameOriginRequest(request);

  if (sameOriginError) {
    return sameOriginError;
  }

  const authResult = await requireAuthenticatedApiUser({
    ensurePreparedProfile: true,
  });

  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { user } = authResult;
  const rateLimitError = enforceRateLimit({
    bucket: "api:profile:patch",
    key: user.id,
    limit: 10,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const payloadResult = await parseJsonBody(request, profileUpdateSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const { avatarUrl, name } = payloadResult.data;
  let profile;

  try {
    profile = await updateBaseBuddyConfigUserProfile({
      avatarUrl,
      name,
      userId: user.id,
    });
  } catch (error) {
    const message = getProductionErrorMessage(error, "Could not update your profile right now.");
    return NextResponse.json({ error: message }, { status: 500 });
  }

  invalidateControlPlaneRuntimeCache({
    groups: ["profile-bootstrap"],
    userId: user.id,
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/settings/profile");

  return NextResponse.json({
    profile: {
      avatarUrl: profile.avatarUrl,
      email: profile.email ?? user.email ?? null,
      name: getUserDisplayName(profile.email ?? user.email ?? null, profile.name),
    },
  });
}
