import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedApiRequestContextMock,
  validateInstallRuntimeConfigurationMock,
} = vi.hoisted(() => ({
  getAuthenticatedApiRequestContextMock: vi.fn(),
  validateInstallRuntimeConfigurationMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  APP_SETUP_REQUIRED_MESSAGE:
    "BaseBuddy setup is incomplete. Open setup to review the app configuration, content connection, sign-in, and upload storage.",
  getAuthenticatedApiRequestContext: getAuthenticatedApiRequestContextMock,
}));

vi.mock("@/lib/self-host/install-runtime", () => ({
  validateInstallRuntimeConfiguration: validateInstallRuntimeConfigurationMock,
}));

describe("API setup-required guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInstallRuntimeConfigurationMock.mockImplementation(() => undefined);
    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      supabase: {},
      user: { id: "user-1" },
    });
  });

  it("returns setup-required before regular API auth creates a Supabase session", async () => {
    validateInstallRuntimeConfigurationMock.mockImplementation(() => {
      throw new Error("Missing required environment variable: BASEBUDDY_SUPABASE_URL");
    });
    const { requireAuthenticatedApiUser } = await import("@/lib/api/api-auth");

    const result = await requireAuthenticatedApiUser();
    const body = await result.errorResponse?.json();

    expect(result.user).toBeNull();
    expect(result.supabase).toBeNull();
    expect(result.errorResponse?.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review the app configuration, content connection, sign-in, and upload storage.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
  });

  it("returns setup-required before project API auth creates a Supabase session", async () => {
    validateInstallRuntimeConfigurationMock.mockImplementation(() => {
      throw new Error("Use either the same-project env names or the split-project env names, not both.");
    });
    const { requireAuthenticatedProjectApiUser } = await import("@/lib/api/project-api-auth");

    const result = await requireAuthenticatedProjectApiUser();
    const body = await result.errorResponse?.json();

    expect(result.user).toBeNull();
    expect(result.supabase).toBeNull();
    expect(result.errorResponse?.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review the app configuration, content connection, sign-in, and upload storage.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
  });

  it("continues to normal auth once setup env is valid", async () => {
    const { requireAuthenticatedApiUser } = await import("@/lib/api/api-auth");

    const result = await requireAuthenticatedApiUser();

    expect(result.errorResponse).toBeNull();
    expect(result.user).toEqual({ id: "user-1" });
    expect(getAuthenticatedApiRequestContextMock).toHaveBeenCalledWith({
      ensurePreparedProfile: false,
    });
  });
});
