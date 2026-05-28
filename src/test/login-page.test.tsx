import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBaseBuddyConfigSetupStatusMock,
  getOptionalAuthenticatedUserWithAccountMock,
  isBaseBuddyConfigSetupReadyMock,
  redirectMock,
  replaceMock,
  refreshMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  getBaseBuddyConfigSetupStatusMock: vi.fn(),
  getOptionalAuthenticatedUserWithAccountMock: vi.fn(),
  isBaseBuddyConfigSetupReadyMock: vi.fn(),
  redirectMock: vi.fn(),
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
  toastErrorMock: vi.fn(),
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
    refresh: refreshMock,
    replace: replaceMock,
  }),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getOptionalAuthenticatedUserWithAccount: getOptionalAuthenticatedUserWithAccountMock,
}));

vi.mock("@/lib/basebuddy-config/setup", () => ({
  getBaseBuddyConfigSetupStatus: getBaseBuddyConfigSetupStatusMock,
  isBaseBuddyConfigSetupReady: isBaseBuddyConfigSetupReadyMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

describe("login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy.config.json",
      sections: [],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(true);
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: null,
      user: null,
    });
    delete process.env.BASEBUDDY_DEMO_LOGIN_ENABLED;
    delete process.env.BASEBUDDY_DEMO_USER_EMAIL;
    delete process.env.BASEBUDDY_DEMO_USER_PASSWORD;
    window.history.replaceState({}, "", "/login?next=/invite/invite-token-123&email=writer@example.com");
  });

  it("redirects authenticated users away from the login page", async () => {
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "teja@example.com",
        name: "Teja",
      },
      user: {
        id: "user_123",
      },
    });

    const LoginRoute = (await import("@/app/login/page")).default;

    await LoginRoute({
      searchParams: Promise.resolve({
        email: "writer@example.com",
        next: "/invite/invite-token-123",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/invite/invite-token-123");
  });

  it("redirects to setup before reading auth when setup is incomplete", async () => {
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(false);
    redirectMock.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const LoginRoute = (await import("@/app/login/page")).default;

    await expect(LoginRoute()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
    expect(getOptionalAuthenticatedUserWithAccountMock).not.toHaveBeenCalled();
  });

  it("prefills the invited email and signs in through the local auth API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    expect(screen.getByLabelText(/email/i)).toHaveValue("writer@example.com");
    expect(screen.queryByRole("button", { name: /continue with github/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign-in link/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: {
        value: "Playwright!12345",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
        body: JSON.stringify({
          email: "writer@example.com",
          password: "Playwright!12345",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      expect(replaceMock).toHaveBeenCalledWith("/invite/invite-token-123");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("filters raw local auth failures before showing them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: "scrypt failed with raw token secret at /api/auth/login",
          },
          { status: 500 },
        ),
      ),
    );
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: {
        value: "Playwright!12345",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Could not sign in.");
    });
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain("raw token secret");
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain("/api/auth/login");
  });

  it("shows and fills demo credentials only when provided by the route", async () => {
    const { LoginForm } = await import("@/app/login/login-form");

    render(
      <LoginForm
        demoAccess={{
          email: "demo@basebuddycms.com",
          password: "BaseBuddyDemo2026!",
        }}
        initialEmail=""
        nextPath="/projects"
      />,
    );

    expect(screen.getByText("Public demo access")).toBeInTheDocument();
    expect(screen.getByText("demo@basebuddycms.com")).toBeInTheDocument();
    expect(screen.getByText("BaseBuddyDemo2026!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /fill demo credentials/i }));

    expect(screen.getByLabelText(/email/i)).toHaveValue("demo@basebuddycms.com");
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("BaseBuddyDemo2026!");
  });

  it("passes hosted demo credentials from runtime env when explicitly enabled", async () => {
    process.env.BASEBUDDY_DEMO_LOGIN_ENABLED = "1";
    process.env.BASEBUDDY_DEMO_USER_EMAIL = "demo@basebuddycms.com";
    process.env.BASEBUDDY_DEMO_USER_PASSWORD = "BaseBuddyDemo2026!";

    const LoginRoute = (await import("@/app/login/page")).default;
    const page = await LoginRoute();

    render(page as React.ReactElement);

    expect(screen.getByText("Public demo access")).toBeInTheDocument();
    expect(screen.getByText("demo@basebuddycms.com")).toBeInTheDocument();
    expect(screen.getByText("BaseBuddyDemo2026!")).toBeInTheDocument();
  });
});
