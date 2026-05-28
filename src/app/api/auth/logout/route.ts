import { NextResponse } from "next/server";

import { clearLocalAuthenticatedSession } from "@/lib/auth/local-auth";
import { appendBaseBuddyAuditEvent } from "@/lib/basebuddy-config/audit-log";
import { getClientIp } from "@/lib/api/request-guards";

export const runtime = "nodejs";

const parseCookieHeader = (header: string | null) => {
  const cookies = new Map<string, string>();

  for (const part of header?.split(";") ?? []) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    const name = rawName?.trim();

    if (!name) {
      continue;
    }

    cookies.set(name, rawValueParts.join("="));
  }

  return cookies;
};

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const requestCookies = parseCookieHeader(request.headers.get("cookie"));

  const session = await clearLocalAuthenticatedSession({
    cookies: {
      get: (name) => {
        const value = requestCookies.get(name);

        return value ? { value } : undefined;
      },
      set: response.cookies.set.bind(response.cookies),
    },
    request,
  });
  await appendBaseBuddyAuditEvent({
    actorEmail: session?.user.email ?? null,
    actorUserId: session?.user.id ?? null,
    ipAddress: getClientIp(request),
    type: "auth.logout",
    userAgent: request.headers.get("user-agent"),
  });

  return response;
}
