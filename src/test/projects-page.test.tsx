import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

const {
  getControlPlaneSchemaSetupSectionMock,
  getInstallSetupStatusMock,
  getProjectsPageBootstrapMock,
  isInstallSetupReadyMock,
  redirectMock,
} = vi.hoisted(() => ({
  getControlPlaneSchemaSetupSectionMock: vi.fn(),
  getInstallSetupStatusMock: vi.fn(),
  getProjectsPageBootstrapMock: vi.fn(),
  isInstallSetupReadyMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/projects/project-creation-hooks", () => ({
  useProjectCreationSlugState: () => ({
    detail: "This slug is available.",
    normalizedSlug: "demo-project",
    status: "available",
  }),
}));

vi.mock("@/components/account/account-menu", () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}));

vi.mock("@/components/projects/app-setup-notice", () => ({
  AppSetupNotice: ({ ctaLabel }: { ctaLabel: string }) => <div>{ctaLabel}</div>,
}));

vi.mock("@/lib/control-plane/server", () => ({
  getProjectsPageBootstrap: getProjectsPageBootstrapMock,
}));

vi.mock("@/lib/self-host/install-runtime", () => ({
  getControlPlaneSchemaSetupSection: getControlPlaneSchemaSetupSectionMock,
  getInstallSetupStatus: getInstallSetupStatusMock,
  isInstallSetupReady: isInstallSetupReadyMock,
}));

describe("projects page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getControlPlaneSchemaSetupSectionMock.mockResolvedValue({
      checks: [],
      description: "Ready",
      status: "ready",
      title: "BaseBuddy tables",
    });
    getInstallSetupStatusMock.mockReturnValue({
      sections: [],
      topology: "unified",
    });
    isInstallSetupReadyMock.mockReturnValue(true);
  });

  it("describes the project list as the local self-host install workspace", async () => {
    getProjectsPageBootstrapMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner User",
      },
      errorMessage: null,
      projects: [],
      setupRequired: false,
    });

    const ProjectsPage = (await import("@/app/projects/page")).default;

    render(await ProjectsPage());

    expect(screen.getByText("Workspaces in this install")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /setup/i })).not.toBeInTheDocument();
    expect(screen.getByText("Create your first project, then connect your content.")).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /create project/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Your projects")).not.toBeInTheDocument();
  });

  it("redirects to setup before loading projects when setup is incomplete", async () => {
    isInstallSetupReadyMock.mockReturnValue(false);
    redirectMock.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const ProjectsPage = (await import("@/app/projects/page")).default;

    await expect(ProjectsPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
    expect(getProjectsPageBootstrapMock).not.toHaveBeenCalled();
  });
});
