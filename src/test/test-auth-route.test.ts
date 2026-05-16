import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublishableKey: () => "test-publishable-key",
  getSupabaseUrl: () => "http://localhost:54321",
}));

describe("Playwright test auth route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createServerClientMock.mockClear();
  });

  it("stays unavailable in production even when test credentials are present", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BASEBUDDY_ENABLE_TEST_AUTH", "1");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:3100");
    vi.stubEnv("PLAYWRIGHT_OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("PLAYWRIGHT_OWNER_PASSWORD", "password-123");

    const { GET } = await import("@/app/api/test-auth/playwright-sign-in/route");
    const response = await GET(
      new NextRequest("http://localhost:3100/api/test-auth/playwright-sign-in?role=owner&next=/projects"),
    );

    expect(response.status).toBe(404);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("stays unavailable until the Playwright runtime flag is present", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BASEBUDDY_ENABLE_TEST_AUTH", "1");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:3100");
    vi.stubEnv("PLAYWRIGHT_OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("PLAYWRIGHT_OWNER_PASSWORD", "password-123");

    const { GET } = await import("@/app/api/test-auth/playwright-sign-in/route");
    const response = await GET(
      new NextRequest("http://localhost:3100/api/test-auth/playwright-sign-in?role=owner&next=/projects"),
    );

    expect(response.status).toBe(404);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("stays unavailable outside production until test auth is explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:3100");
    vi.stubEnv("PLAYWRIGHT_OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("PLAYWRIGHT_OWNER_PASSWORD", "password-123");

    const { GET } = await import("@/app/api/test-auth/playwright-sign-in/route");
    const response = await GET(
      new NextRequest("http://localhost:3100/api/test-auth/playwright-sign-in?role=owner&next=/projects"),
    );

    expect(response.status).toBe(404);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("signs in a Playwright role only when test auth is explicitly enabled outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BASEBUDDY_ENABLE_TEST_AUTH", "1");
    vi.stubEnv("BASEBUDDY_PLAYWRIGHT_RUNTIME", "1");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:3100");
    vi.stubEnv("PLAYWRIGHT_OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("PLAYWRIGHT_OWNER_PASSWORD", "password-123");

    const { GET } = await import("@/app/api/test-auth/playwright-sign-in/route");
    const response = await GET(
      new NextRequest("http://localhost:3100/api/test-auth/playwright-sign-in?role=owner&next=/projects"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3100/projects");
    expect(createServerClientMock).toHaveBeenCalledOnce();
  });

  it("allows production-mode Playwright smoke tests only inside the Playwright runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BASEBUDDY_ENABLE_TEST_AUTH", "1");
    vi.stubEnv("BASEBUDDY_PLAYWRIGHT_RUNTIME", "1");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:3100");
    vi.stubEnv("PLAYWRIGHT_OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("PLAYWRIGHT_OWNER_PASSWORD", "password-123");

    const { GET } = await import("@/app/api/test-auth/playwright-sign-in/route");
    const response = await GET(
      new NextRequest("http://localhost:3100/api/test-auth/playwright-sign-in?role=owner&next=/projects"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3100/projects");
    expect(createServerClientMock).toHaveBeenCalledOnce();
  });
});
