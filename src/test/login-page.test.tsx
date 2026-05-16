import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildBrowserRedirectUrlMock,
  getControlPlaneSchemaSetupSectionMock,
  getInstallAuthProvidersMock,
  getInstallSetupStatusMock,
  getOptionalAuthenticatedUserWithAccountMock,
  isInstallSetupReadyMock,
  replaceMock,
  signInWithOAuthMock,
  signInWithOtpMock,
  signInWithPasswordMock,
  toastErrorMock,
  toastSuccessMock,
  redirectMock,
} = vi.hoisted(() => ({
  buildBrowserRedirectUrlMock: vi.fn((path: string) => `http://localhost${path}`),
  getControlPlaneSchemaSetupSectionMock: vi.fn(),
  getInstallAuthProvidersMock: vi.fn(),
  getInstallSetupStatusMock: vi.fn(),
  getOptionalAuthenticatedUserWithAccountMock: vi.fn(),
  isInstallSetupReadyMock: vi.fn(),
  redirectMock: vi.fn(),
  replaceMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  signInWithOtpMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
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
    replace: replaceMock,
  }),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getOptionalAuthenticatedUserWithAccount: getOptionalAuthenticatedUserWithAccountMock,
}));

vi.mock("@/lib/self-host/auth-providers", () => ({
  getInstallAuthProviders: getInstallAuthProvidersMock,
}));

vi.mock("@/lib/self-host/install-runtime", () => ({
  getControlPlaneSchemaSetupSection: getControlPlaneSchemaSetupSectionMock,
  getInstallSetupStatus: getInstallSetupStatusMock,
  isInstallSetupReady: isInstallSetupReadyMock,
}));

vi.mock("@/lib/supabase/auth", () => ({
  buildBrowserRedirectUrl: buildBrowserRedirectUrlMock,
  getSafeNextPath: (value: string | null | undefined) => {
    const normalizedValue = value?.trim();
    return normalizedValue && normalizedValue.startsWith("/") ? normalizedValue : "/projects";
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: signInWithOAuthMock,
      signInWithOtp: signInWithOtpMock,
      signInWithPassword: signInWithPasswordMock,
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

describe("login route", () => {
  beforeEach(() => {
    buildBrowserRedirectUrlMock.mockClear();
    getControlPlaneSchemaSetupSectionMock.mockReset();
    getInstallAuthProvidersMock.mockReset();
    getInstallSetupStatusMock.mockReset();
    getOptionalAuthenticatedUserWithAccountMock.mockReset();
    isInstallSetupReadyMock.mockReset();
    getControlPlaneSchemaSetupSectionMock.mockResolvedValue({
      checks: [],
      description: "Ready",
      status: "ready",
      title: "BaseBuddy tables",
    });
    getInstallAuthProvidersMock.mockReturnValue(["github", "google", "magic_link", "password"]);
    getInstallSetupStatusMock.mockReturnValue({
      sections: [],
      topology: "unified",
    });
    isInstallSetupReadyMock.mockReturnValue(true);
    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: null,
      user: null,
    });
    redirectMock.mockClear();
    replaceMock.mockClear();
    signInWithOAuthMock.mockReset();
    signInWithOtpMock.mockReset();
    signInWithPasswordMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    signInWithOAuthMock.mockResolvedValue({ error: null });
    signInWithOtpMock.mockResolvedValue({ error: null });
    signInWithPasswordMock.mockResolvedValue({ error: null });
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
    isInstallSetupReadyMock.mockReturnValue(false);
    redirectMock.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const LoginRoute = (await import("@/app/login/page")).default;

    await expect(LoginRoute()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
    expect(getOptionalAuthenticatedUserWithAccountMock).not.toHaveBeenCalled();
  });

  it("prefills the invited email and preserves the invite next path for email sign-in", async () => {
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    expect(screen.getByLabelText(/email/i)).toHaveValue("writer@example.com");

    fireEvent.click(screen.getByRole("button", { name: /sign-in link/i }));

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledWith({
        email: "writer@example.com",
        options: {
          emailRedirectTo: "http://localhost/auth/confirm?next=%2Finvite%2Finvite-token-123",
        },
      });
    });
  });

  it("preserves the invite next path for oauth sign-in too", async () => {
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    fireEvent.click(screen.getByRole("button", { name: /continue with github/i }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        options: {
          redirectTo: "http://localhost/auth/callback?next=%2Finvite%2Finvite-token-123",
        },
        provider: "github",
      });
    });
  });

  it("keeps authentication error copy provider-neutral", async () => {
    const { LoginForm } = await import("@/app/login/login-form");

    render(
      <LoginForm
        initialEmail="writer@example.com"
        initialError="auth_callback_error"
        nextPath="/invite/invite-token-123"
      />,
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Could not complete sign-in.");
    });
  });

  it("filters raw OAuth provider errors before showing them", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({
      error: new Error(
        "OAuth provider google failed at https://project.supabase.co/auth/v1/authorize with client_secret=raw-secret",
      ),
    });
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    fireEvent.click(screen.getByRole("button", { name: /continue with github/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Could not start sign-in.");
    });
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain("client_secret");
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain("supabase.co/auth");
  });

  it("filters raw password provider errors before showing them", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      error: new Error("GoTrueApiError: invalid_grant at /auth/v1/token stack=internal"),
    });
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: {
        value: "Playwright!12345",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in with password/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Could not sign in with email and password.",
      );
    });
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain("GoTrueApiError");
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain("/auth/v1/token");
  });

  it("keeps email sign-in success copy provider-neutral", async () => {
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    fireEvent.click(screen.getByRole("button", { name: /sign-in link/i }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Check your email for the sign-in link.");
    });
  });

  it("supports password sign-in and redirects to the preserved next path", async () => {
    const { LoginForm } = await import("@/app/login/login-form");

    render(<LoginForm initialEmail="writer@example.com" nextPath="/invite/invite-token-123" />);

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: {
        value: "Playwright!12345",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in with password/i }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "writer@example.com",
        password: "Playwright!12345",
      });
      expect(replaceMock).toHaveBeenCalledWith("/invite/invite-token-123");
    });
  });

  it("only shows sign-in methods enabled for this install", async () => {
    const { LoginForm } = await import("@/app/login/login-form");

    render(
      <LoginForm
        enabledProviders={["magic_link", "google"]}
        initialEmail="writer@example.com"
        nextPath="/invite/invite-token-123"
      />,
    );

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign-in link/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with github/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in with password/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });
});
