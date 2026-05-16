import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedApiUser } from "@/lib/api/api-auth";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { invalidateControlPlaneRuntimeCache } from "@/lib/control-plane/server-runtime-cache";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import { getUserDisplayName } from "@/lib/control-plane/utils";
import {
  enforceRateLimit,
  enforceSameOriginRequest,
  parseJsonBody,
} from "@/lib/api/request-guards";

export const runtime = "nodejs";

type ProfileRow = {
  avatar_url: string | null;
  email: string | null;
  name: string | null;
};

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

  const { supabase, user } = authResult;
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
  const expectedAvatarUrl = supabase.storage.from("profile_avatars").getPublicUrl(`${user.id}/avatar`).data.publicUrl;

  if (avatarUrl && avatarUrl !== expectedAvatarUrl) {
    return NextResponse.json(
      { error: "Avatar URL does not match your profile avatar path." },
      { status: 400 },
    );
  }

  const updates: {
    avatar_url?: string | null;
    name: string;
  } = { name };

  if (avatarUrl !== undefined) {
    updates.avatar_url = avatarUrl;
  }

  const { data, error } = await supabase
    .from("basebuddy_profiles")
    .update(updates)
    .eq("id", user.id)
    .select("email, name, avatar_url")
    .maybeSingle();

  if (error) {
    if (isControlPlaneSetupError(error)) {
      return NextResponse.json({ error: APP_SETUP_REQUIRED_MESSAGE }, { status: 500 });
    }

    const message = getProductionErrorMessage(error, "Could not update your profile right now.");
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const profile = data as ProfileRow | null;

  invalidateControlPlaneRuntimeCache({
    groups: ["profile-bootstrap"],
    userId: user.id,
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/settings/profile");

  return NextResponse.json({
    profile: {
      avatarUrl: profile?.avatar_url ?? avatarUrl ?? null,
      email: profile?.email ?? user.email ?? null,
      name: getUserDisplayName(profile?.email ?? user.email ?? null, profile?.name ?? name),
    },
  });
}
