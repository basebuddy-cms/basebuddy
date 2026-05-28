import { NextResponse } from "next/server";

import { requireAuthenticatedApiUser } from "@/lib/api/api-auth";
import { isConfigProjectSlugAvailable } from "@/lib/basebuddy-config/projects";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { normalizeProjectSlug } from "@/lib/control-plane/utils";

export async function GET(request: Request) {
  const rawSlug = new URL(request.url).searchParams.get("slug") ?? "";
  const normalizedSlug = normalizeProjectSlug(rawSlug);

  if (!normalizedSlug) {
    return NextResponse.json(
      { available: false, normalizedSlug, reason: "Enter a project address first." },
      { status: 400 },
    );
  }

  const authResult = await requireAuthenticatedApiUser();

  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  try {
    const available = await isConfigProjectSlugAvailable(normalizedSlug);

    return NextResponse.json({
      available,
      normalizedSlug,
    });
  } catch (error) {
    const message = getProductionErrorMessage(error, "Could not check project address availability right now.");
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
