import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

const {
  getControlPlaneSchemaSetupSectionMock,
  getInstallSetupStatusMock,
  getOptionalAuthenticatedUserWithAccountMock,
  getProjectsPageBootstrapMock,
  isInstallSetupReadyMock,
  redirectMock,
} = vi.hoisted(() => ({
  getControlPlaneSchemaSetupSectionMock: vi.fn(),
  getInstallSetupStatusMock: vi.fn(),
  getOptionalAuthenticatedUserWithAccountMock: vi.fn(),
  getProjectsPageBootstrapMock: vi.fn(),
  isInstallSetupReadyMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/control-plane/server", () => ({
  getOptionalAuthenticatedUserWithAccount: getOptionalAuthenticatedUserWithAccountMock,
  getProjectsPageBootstrap: getProjectsPageBootstrapMock,
}));

vi.mock("@/lib/self-host/install-runtime", () => ({
  getControlPlaneSchemaSetupSection: getControlPlaneSchemaSetupSectionMock,
  getInstallSetupStatus: getInstallSetupStatusMock,
  isInstallSetupReady: isInstallSetupReadyMock,
}));

const readySetupStatus = {
  sections: [
    {
      checks: [],
      description: "Ready",
      status: "ready",
      title: "App configuration",
    },
  ],
  topology: "split",
};

describe("home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getControlPlaneSchemaSetupSectionMock.mockResolvedValue({
      checks: [],
      description: "Ready",
      status: "ready",
      title: "BaseBuddy tables",
    });
    getInstallSetupStatusMock.mockReturnValue(readySetupStatus);
    isInstallSetupReadyMock.mockReturnValue(true);
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: null,
      user: null,
    });
    getProjectsPageBootstrapMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner User",
      },
      errorMessage: null,
      hasMoreProjects: false,
      projectSearchQuery: "",
      projects: [],
      setupRequired: false,
    });
  });

  it("sends incomplete installs to setup before checking authentication", async () => {
    isInstallSetupReadyMock.mockReturnValue(false);
    getInstallSetupStatusMock.mockReturnValue({
      sections: [
        {
          checks: [],
          description: "Missing",
          status: "missing",
          title: "App configuration",
        },
      ],
      topology: "invalid",
    });

    const HomePage = (await import("@/app/page")).default;

    await HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
    expect(getOptionalAuthenticatedUserWithAccountMock).not.toHaveBeenCalled();
  });

  it("sends signed-out users with a ready install to login", async () => {
    const HomePage = (await import("@/app/page")).default;

    await HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("sends signed-in users with no projects to first project creation", async () => {
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner User",
      },
      user: {
        id: "user_123",
      },
    });

    const HomePage = (await import("@/app/page")).default;

    await HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/projects#new-project");
  });

  it("sends signed-in users with existing projects to projects", async () => {
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner User",
      },
      user: {
        id: "user_123",
      },
    });
    getProjectsPageBootstrapMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner User",
      },
      errorMessage: null,
      hasMoreProjects: false,
      projectSearchQuery: "",
      projects: [
        {
          createdAt: "2026-05-07T00:00:00.000Z",
          id: "project-1",
          name: "Demo Project",
          role: "owner",
          slug: "demo-project",
          websiteUrl: null,
        },
      ],
      setupRequired: false,
    });

    const HomePage = (await import("@/app/page")).default;

    await HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/projects");
  });
});
