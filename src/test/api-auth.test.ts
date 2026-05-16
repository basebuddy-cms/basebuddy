import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getAuthenticatedApiRequestContextMock,
  validateInstallRuntimeConfigurationMock,
} = vi.hoisted(() => ({
  getAuthenticatedApiRequestContextMock: vi.fn(),
  validateInstallRuntimeConfigurationMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  APP_SETUP_REQUIRED_MESSAGE: "BaseBuddy setup is incomplete.",
  getAuthenticatedApiRequestContext: getAuthenticatedApiRequestContextMock,
}));

vi.mock("@/lib/self-host/install-runtime", () => ({
  validateInstallRuntimeConfiguration: validateInstallRuntimeConfigurationMock,
}));

describe("non-project API auth helper", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthenticatedApiRequestContextMock.mockReset();
    validateInstallRuntimeConfigurationMock.mockReset();
  });

  it("passes through a successful authenticated API context", async () => {
    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      supabase: {
        from: vi.fn(),
      },
      user: {
        id: "user-1",
      },
    });

    const { requireAuthenticatedApiUser } = await import("@/lib/api/api-auth");

    await expect(
      requireAuthenticatedApiUser({
        ensurePreparedProfile: true,
      }),
    ).resolves.toMatchObject({
      errorResponse: null,
      user: {
        id: "user-1",
      },
    });

    expect(getAuthenticatedApiRequestContextMock).toHaveBeenCalledWith({
      ensurePreparedProfile: true,
    });
  });

  it("allows route-specific unauthenticated messages", async () => {
    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      supabase: {},
      user: null,
    });

    const { requireAuthenticatedApiUser } = await import("@/lib/api/api-auth");

    const result = await requireAuthenticatedApiUser({
      unauthenticatedMessage: "Your session expired. Sign in again, then retry the connection check.",
    });

    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(401);
    await expect(result.errorResponse?.json()).resolves.toEqual({
      error: "Your session expired. Sign in again, then retry the connection check.",
    });
  });

  it("can redirect unauthenticated API callers instead of returning json", async () => {
    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      supabase: {},
      user: null,
    });

    const { requireAuthenticatedApiUserOrRedirect } = await import("@/lib/api/api-auth");

    const result = await requireAuthenticatedApiUserOrRedirect(new URL("https://example.com/login"));

    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(307);
    expect(result.errorResponse?.headers.get("location")).toBe("https://example.com/login");
  });

  it("keeps non-auth API failures as json even when redirect mode is requested", async () => {
    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      errorMessage: "Could not prepare your account right now.",
      ok: false,
      status: 500,
      supabase: {},
      user: null,
    });

    const { requireAuthenticatedApiUserOrRedirect } = await import("@/lib/api/api-auth");

    const result = await requireAuthenticatedApiUserOrRedirect(new URL("https://example.com/login"));

    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(500);
    await expect(result.errorResponse?.json()).resolves.toEqual({
      error: "Could not prepare your account right now.",
    });
  });
});
