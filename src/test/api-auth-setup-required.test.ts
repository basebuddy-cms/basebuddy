import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBaseBuddyConfigSetupStatusMock,
  getAuthenticatedApiRequestContextMock,
  isBaseBuddyConfigSetupReadyMock,
} = vi.hoisted(() => ({
  getBaseBuddyConfigSetupStatusMock: vi.fn(),
  getAuthenticatedApiRequestContextMock: vi.fn(),
  isBaseBuddyConfigSetupReadyMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getAuthenticatedApiRequestContext: getAuthenticatedApiRequestContextMock,
}));

vi.mock("@/lib/basebuddy-config/setup", () => ({
  BASEBUDDY_SETUP_REQUIRED_MESSAGE:
    "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.",
  getBaseBuddyConfigSetupStatus: getBaseBuddyConfigSetupStatusMock,
  isBaseBuddyConfigSetupReady: isBaseBuddyConfigSetupReadyMock,
}));

describe("API setup-required guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy.config.json",
      sections: [],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(true);
    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      ok: true,
      user: { id: "user-1" },
    });
  });

  it("returns setup-required before regular API auth reads the local session", async () => {
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy.config.json",
      sections: [
        {
          checks: [],
          description: "Create basebuddy.config.json in the app root.",
          status: "missing",
          title: "Config file",
        },
      ],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
    const { requireAuthenticatedApiUser } = await import("@/lib/api/api-auth");

    const result = await requireAuthenticatedApiUser();
    const body = await result.errorResponse?.json();

    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
  });

  it("returns setup-required before project API auth reads the local session", async () => {
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy.config.json",
      sections: [
        {
          checks: [],
          description: "basebuddy.config.json is invalid.",
          status: "invalid",
          title: "Config file",
        },
      ],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
    const { requireAuthenticatedProjectApiUser } = await import("@/lib/api/project-api-auth");

    const result = await requireAuthenticatedProjectApiUser();
    const body = await result.errorResponse?.json();

    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.",
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
