import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

const {
  getBaseBuddyConfigSetupStatusMock,
  getOptionalAuthenticatedUserWithAccountMock,
  isBaseBuddyConfigSetupReadyMock,
  redirectMock,
} = vi.hoisted(() => ({
  getBaseBuddyConfigSetupStatusMock: vi.fn(),
  getOptionalAuthenticatedUserWithAccountMock: vi.fn(),
  isBaseBuddyConfigSetupReadyMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/components/projects/onboarding-shell", () => ({
  OnboardingShell: () => <div>Loading setup</div>,
}));

vi.mock("@/components/projects/onboarding-setup-view", () => ({
  OnboardingSetupView: ({ readOnly }: { readOnly?: boolean }) => (
    <div>{readOnly ? "Setup summary" : "Setup wizard"}</div>
  ),
}));

vi.mock("@/lib/basebuddy-config/setup", () => ({
  getBaseBuddyConfigSetupStatus: getBaseBuddyConfigSetupStatusMock,
  isBaseBuddyConfigSetupReady: isBaseBuddyConfigSetupReadyMock,
}));

vi.mock("@/lib/control-plane/server", () => ({
  getOptionalAuthenticatedUserWithAccount: getOptionalAuthenticatedUserWithAccountMock,
}));

describe("onboarding route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy.config.json",
      sections: [],
      topology: "config-file",
    });
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({ account: null, user: null });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(true);
  });

  it("renders a read-only setup summary for signed-out visitors after setup is ready", async () => {
    const OnboardingRoute = (await import("@/app/onboarding/page")).default;

    render(await OnboardingRoute());

    expect(screen.getByText("Setup summary")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects signed-in users away from onboarding after setup is ready", async () => {
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: { email: "owner@example.com", name: "Owner" },
      user: { id: "user-1" },
    });
    redirectMock.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const OnboardingRoute = (await import("@/app/onboarding/page")).default;

    await expect(OnboardingRoute()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/projects");
  });

  it("renders setup diagnostics when explicitly requested after setup is ready", async () => {
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: { email: "owner@example.com", name: "Owner" },
      user: { id: "user-1" },
    });
    const OnboardingRoute = (await import("@/app/onboarding/page")).default;

    render(await OnboardingRoute({ searchParams: { diagnostics: "1" } }));

    expect(screen.getByText("Setup summary")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("renders setup wizard while setup is incomplete", async () => {
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
    const OnboardingRoute = (await import("@/app/onboarding/page")).default;

    render(await OnboardingRoute());

    expect(screen.getByText("Setup wizard")).toBeInTheDocument();
  });
});
