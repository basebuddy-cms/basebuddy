import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/supabase/auth";
import { exchangeServerAuthCode } from "@/lib/supabase/server-auth";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const result = await exchangeServerAuthCode(code);

    if (result.ok) {
      return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_error", requestUrl.origin));
}
