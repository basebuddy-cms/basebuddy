import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/security/headers";
import {
  getOptionalSupabasePublishableKey,
  getOptionalSupabaseUrl,
} from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  const contentSecurityPolicy = buildContentSecurityPolicy({
    isProduction: process.env.NODE_ENV === "production",
    scriptNonce: nonce,
    supabaseUrl: getOptionalSupabaseUrl(),
  });

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  const supabaseUrl = getOptionalSupabaseUrl();
  const supabasePublishableKey = getOptionalSupabasePublishableKey();

  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          response.headers.set("Content-Security-Policy", contentSecurityPolicy);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the session so it doesn't expire mid-request.
  // This avoids the slow token-refresh round-trip inside server components.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Run on page routes only (not API routes or static assets).
    // API routes handle their own auth; adding middleware there doubles auth calls.
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
