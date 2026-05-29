import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const {
  getAuthenticatedApiRequestContextMock,
  ensureContentMappingDraftMock,
  getContentWorkspaceMetaMock,
  getBaseBuddyConfigSetupStatusMock,
  isBaseBuddyConfigSetupReadyMock,
} = vi.hoisted(() => ({
  getAuthenticatedApiRequestContextMock: vi.fn(),
  ensureContentMappingDraftMock: vi.fn(),
  getContentWorkspaceMetaMock: vi.fn(),
  getBaseBuddyConfigSetupStatusMock: vi.fn(),
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

vi.mock("@/lib/content-runtime/server", () => ({
  ensureContentMappingDraft: ensureContentMappingDraftMock,
  getContentWorkspaceMeta: getContentWorkspaceMetaMock,
}));

describe("project API setup-required responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy-data/basebuddy.config.json",
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
    getContentWorkspaceMetaMock.mockResolvedValue({ collections: [] });
  });

  it("returns a clean setup-required response before content API work runs", async () => {
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy-data/basebuddy.config.json",
      sections: [
        {
          checks: [],
          description: "Create basebuddy-data/basebuddy.config.json.",
          status: "missing",
          title: "Config file",
        },
      ],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
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
        "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
    expect(getContentWorkspaceMetaMock).not.toHaveBeenCalled();
  });

  it("returns setup-required before project creation writes config", async () => {
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy-data/basebuddy.config.json",
      sections: [
        {
          checks: [],
          description: "Create basebuddy-data/basebuddy.config.json.",
          status: "missing",
          title: "Config file",
        },
      ],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
    const { POST } = await import("@/app/api/projects/route");

    const response = await POST(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          projectName: "Demo Project",
          projectSlug: "demo-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
    expect(ensureContentMappingDraftMock).not.toHaveBeenCalled();
  });

  it("returns setup-required before project slug availability reads config", async () => {
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy-data/basebuddy.config.json",
      sections: [
        {
          checks: [],
          description: "Create basebuddy-data/basebuddy.config.json.",
          status: "missing",
          title: "Config file",
        },
      ],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
    const { GET } = await import("@/app/api/projects/slug-availability/route");

    const response = await GET(
      new Request("http://localhost/api/projects/slug-availability?slug=demo-project"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
  });

  it("returns setup-required before project settings reads project access", async () => {
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy-data/basebuddy.config.json",
      sections: [
        {
          checks: [],
          description: "Create basebuddy-data/basebuddy.config.json.",
          status: "missing",
          title: "Config file",
        },
      ],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
    const { PATCH } = await import("@/app/api/projects/[projectId]/settings/route");

    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1/settings", {
        body: JSON.stringify({
          name: "Demo Project",
          slug: "demo-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error:
        "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.",
      setupRequired: true,
    });
    expect(getAuthenticatedApiRequestContextMock).not.toHaveBeenCalled();
  });
});
