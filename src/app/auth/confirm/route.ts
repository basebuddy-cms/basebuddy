import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { getSafeNextPath } from "@/lib/supabase/auth";
import { confirmServerAuthIdentity } from "@/lib/supabase/server-auth";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const redirectTo = new URL(nextPath, requestUrl.origin);

  const authResult = await confirmServerAuthIdentity({
    code,
    tokenHash,
    type,
  });

  if (authResult.ok) {
    return NextResponse.redirect(redirectTo);
  }

  return NextResponse.redirect(new URL("/login?error=email_confirm_error", requestUrl.origin));
}
