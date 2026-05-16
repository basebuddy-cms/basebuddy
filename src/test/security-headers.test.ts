import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, getSecurityHeaders } from "@/lib/security/headers";

describe("security headers", () => {
  it("builds the required production headers", () => {
    const headers = getSecurityHeaders({
      isProduction: true,
      supabaseUrl: "https://demo-project.supabase.co",
    });

    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "Content-Security-Policy" }),
        expect.objectContaining({ key: "X-Frame-Options", value: "DENY" }),
        expect.objectContaining({ key: "X-Content-Type-Options", value: "nosniff" }),
        expect.objectContaining({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }),
        expect.objectContaining({ key: "Permissions-Policy" }),
        expect.objectContaining({
          key: "X-Robots-Tag",
          value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
        }),
        expect.objectContaining({
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        }),
      ]),
    );
  });

  it("includes the expected CSP protections and allowed origins", () => {
    const policy = buildContentSecurityPolicy({
      isProduction: true,
      scriptNonce: "test-nonce",
      supabaseUrl: "https://demo-project.supabase.co",
    });

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(policy).toContain("font-src 'self' data: https://fonts.gstatic.com");
    expect(policy).toContain("connect-src 'self' https://demo-project.supabase.co wss://demo-project.supabase.co");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("keeps development-only allowances out of production HSTS decisions", () => {
    const developmentHeaders = getSecurityHeaders({
      isProduction: false,
      supabaseUrl: "https://demo-project.supabase.co",
    });

    const developmentPolicy = buildContentSecurityPolicy({
      isProduction: false,
      supabaseUrl: "https://demo-project.supabase.co",
    });

    expect(developmentHeaders.some((header) => header.key === "Strict-Transport-Security")).toBe(false);
    expect(developmentHeaders.some((header) => header.key === "X-Robots-Tag")).toBe(true);
    expect(developmentPolicy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(developmentPolicy).toContain("'unsafe-eval'");
    expect(developmentPolicy).toContain("http://localhost:*");
    expect(developmentPolicy).toContain("http://127.0.0.1:*");
    expect(developmentPolicy).toContain("ws://localhost:*");
    expect(developmentPolicy).toContain("ws://127.0.0.1:*");
    expect(developmentPolicy).not.toContain("upgrade-insecure-requests");
  });

  it("omits the noindex header when search indexing is explicitly enabled", () => {
    const headers = getSecurityHeaders({
      isProduction: true,
      searchIndexingEnabled: true,
      supabaseUrl: "https://demo-project.supabase.co",
    });

    expect(headers.some((header) => header.key === "X-Robots-Tag")).toBe(false);
  });

  it("can omit CSP from static Next headers so middleware can attach a request nonce", () => {
    const headers = getSecurityHeaders({
      includeContentSecurityPolicy: false,
      isProduction: true,
      supabaseUrl: "https://demo-project.supabase.co",
    });

    expect(headers.some((header) => header.key === "Content-Security-Policy")).toBe(false);
    expect(headers).toEqual(expect.arrayContaining([expect.objectContaining({ key: "X-Frame-Options" })]));
  });
});
