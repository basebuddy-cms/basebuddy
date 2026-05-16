import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedApiRequestContextMock,
  getContentWorkspaceMetaMock,
  validateInstallRuntimeConfigurationMock,
} = vi.hoisted(() => ({
  getAuthenticatedApiRequestContextMock: vi.fn(),
  getContentWorkspaceMetaMock: vi.fn(),
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

vi.mock("@/lib/content-runtime/server", () => ({
  getContentWorkspaceMeta: getContentWorkspaceMetaMock,
}));

describe("project API setup-required responses", () => {
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
    getContentWorkspaceMetaMock.mockResolvedValue({ collections: [] });
  });

  it("returns a clean setup-required response before content API work runs", async () => {
    validateInstallRuntimeConfigurationMock.mockImplementation(() => {
      throw new Error("Missing required environment variable: BASEBUDDY_DATABASE_URL");
    });
    const { GET } = await import("@/app/api/projects/[projectId]/content/workspace/route");

    const response = await GET(
      new Request("http://localhost/api/projects/project-1/content/workspace"),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review the app configuration, content connection, sign-in, and upload storage.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
    expect(getContentWorkspaceMetaMock).not.toHaveBeenCalled();
  });
});
