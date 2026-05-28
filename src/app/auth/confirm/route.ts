import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/redirects";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL("/login", requestUrl.origin);

  redirectUrl.searchParams.set("next", nextPath);
  redirectUrl.searchParams.set("error", "email_confirm_error");

  return NextResponse.redirect(redirectUrl);
}
