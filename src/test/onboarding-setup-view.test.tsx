import React, { type ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingSetupView } from "@/components/projects/onboarding-setup-view";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("OnboardingSetupView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const openStep = (name: RegExp | string) => {
    fireEvent.click(screen.getByRole("button", { name }));
  };

  const confirmEnvStep = () => {
    openStep(/step 2 .env/i);
    fireEvent.click(screen.getByLabelText(/i added these values to `.env`/i));
  };

  const confirmSqlStep = () => {
    openStep(/step 3 sql/i);
    fireEvent.click(screen.getByLabelText(/i ran the basebuddy sql/i));
  };

  const confirmAuthStep = () => {
    openStep(/step 4 auth/i);
    fireEvent.click(screen.getByLabelText(/i enabled these sign-in methods and added the redirect url/i));
  };

  it("renders guided install setup instead of project creation", () => {
    render(<OnboardingSetupView />);

    expect(screen.getByRole("heading", { name: /basebuddy setup/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /choose where basebuddy lives/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /app configuration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /basebuddy tables/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /content connection/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /install layout/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/control-plane/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/content-plane/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RPCs/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open projects/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Install").length).toBeGreaterThan(0);
    expect(screen.getByText("Same project")).toBeInTheDocument();
    expect(screen.getByText("Different project")).toBeInTheDocument();
    expect(screen.queryByText(/for local supabase, add/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/setup is ready/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create project/i })).not.toBeInTheDocument();
  });

  it("includes Vercel redirect URL guidance", () => {
    const { container } = render(<OnboardingSetupView />);
    confirmEnvStep();
    confirmSqlStep();
    openStep(/step 4 auth/i);
    const renderedText = container.textContent ?? "";

    expect(renderedText).toContain("For Vercel, add your deployed `/auth/callback` URL");
    expect(renderedText).toContain("https://your-app.vercel.app/auth/callback");
  });

  it("lets the installer choose same-project or split-project setup without storing secrets", () => {
    render(<OnboardingSetupView />);

    expect(
      screen.getByText((content) =>
        content.includes("Same project"),
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /for stricter separation install basebuddy in a different supabase project/i,
      }),
    );
    openStep(/step 2 .env/i);

    expect(
      screen.getByText((content) =>
        content.includes(
          "BASEBUDDY_CONTROL_SUPABASE_URL=https://your-basebuddy-project-ref.supabase.co",
        ),
      ),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("basebuddy.setup.installMode")).toBe("split");
    expect(JSON.stringify(window.localStorage)).not.toContain("your-secret-key");
  });

  it("renders exact same-project env guidance", () => {
    const { container } = render(<OnboardingSetupView />);
    openStep(/step 2 .env/i);
    const renderedText = container.textContent ?? "";

    expect(renderedText).toContain(`BASEBUDDY_SUPABASE_URL=https://your-project-ref.supabase.co
BASEBUDDY_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
BASEBUDDY_SUPABASE_SECRET_KEY=your-secret-key
BASEBUDDY_DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres
BASEBUDDY_AUTH_PROVIDERS=password`);
  });

  it("renders exact split-project env guidance", () => {
    const { container } = render(<OnboardingSetupView />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /for stricter separation install basebuddy in a different supabase project/i,
      }),
    );
    openStep(/step 2 .env/i);
    const renderedText = container.textContent ?? "";

    expect(renderedText).toContain(`BASEBUDDY_CONTROL_SUPABASE_URL=https://your-basebuddy-project-ref.supabase.co
BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY=your-basebuddy-publishable-key
BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY=your-basebuddy-secret-key
BASEBUDDY_CONTROL_DATABASE_URL=postgresql://postgres.your-basebuddy-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres

BASEBUDDY_CONTENT_SUPABASE_URL=https://your-content-project-ref.supabase.co
BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY=your-content-publishable-key
BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY=your-content-secret-key
BASEBUDDY_CONTENT_DATABASE_URL=postgresql://postgres.your-content-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres
BASEBUDDY_AUTH_PROVIDERS=password`);
  });

  it("renders copyable migration SQL from the baseline file", () => {
    const { container } = render(
      <OnboardingSetupView
        migrationSql={`create schema if not exists private;

create table if not exists public.basebuddy_projects (
  id uuid primary key
);`}
      />,
    );
    confirmEnvStep();
    openStep(/step 3 sql/i);
    const renderedText = container.textContent ?? "";

    expect(screen.getByText(/run the basebuddy sql/i)).toBeInTheDocument();
    expect(screen.getByText(/choose one method below/i)).toBeInTheDocument();
    expect(screen.getByText(/you do not need to run both/i)).toBeInTheDocument();
    expect(screen.getByText(/option 1: supabase cli/i)).toBeInTheDocument();
    expect(screen.getByText(/option 2: supabase sql editor/i)).toBeInTheDocument();
    expect(screen.getByText(/open sql editor, paste the sql, and run it once/i)).toBeInTheDocument();
    expect(renderedText).toContain("create table if not exists public.basebuddy_projects");
    expect(screen.getAllByText("Migration SQL").length).toBeGreaterThan(0);
  });

  it("remembers the saved env confirmation without storing env values", () => {
    render(<OnboardingSetupView />);
    openStep(/step 2 .env/i);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    const savedEnvCheck = screen.getByLabelText(/i added these values to `.env`/i);

    fireEvent.click(savedEnvCheck);

    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(window.localStorage.getItem("basebuddy.setup.envSaved")).toBe("true");
    expect(JSON.stringify(window.localStorage)).not.toContain("BASEBUDDY_SUPABASE_SECRET_KEY");
  });

  it("stores Auth provider choices locally and warns when none are selected", () => {
    render(<OnboardingSetupView />);
    confirmEnvStep();
    confirmSqlStep();
    openStep(/step 4 auth/i);

    const emailProvider = screen.getByLabelText(/email and password/i);
    const googleProvider = screen.getByLabelText(/^google/i);

    expect(emailProvider).toBeChecked();

    fireEvent.click(googleProvider);
    expect(window.localStorage.getItem("basebuddy.setup.authProviders")).toBe(
      JSON.stringify(["email", "google"]),
    );

    fireEvent.click(emailProvider);
    fireEvent.click(googleProvider);

    expect(screen.getByText(/choose at least one sign-in method/i)).toBeInTheDocument();
    expect(JSON.stringify(window.localStorage)).not.toContain("secret");
  });

  it("checks setup through the setup verification API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        ready: false,
        status: {
          topology: "unified",
          sections: [
            {
              checks: [],
              description: "Required app settings for this install.",
              status: "missing",
              title: "App configuration",
            },
          ],
        },
      }),
    );

    render(<OnboardingSetupView />);

    confirmEnvStep();
    confirmSqlStep();
    confirmAuthStep();
    openStep(/step 5 check/i);
    fireEvent.click(screen.getByRole("button", { name: "Check setup" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/setup/check", {
        body: "{}",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });
    expect(screen.getByRole("heading", { name: "App configuration" })).toBeInTheDocument();
    expect(screen.getByText(/1 setup item needs attention/i)).toBeInTheDocument();
  });

  it("renders redacted setup status values", () => {
    render(
      <OnboardingSetupView
        status={{
          topology: "split",
          sections: [
            {
              checks: [
                {
                  key: "BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY",
                  label: "Control-plane secret key",
                  required: true,
                  status: "ready",
                  value: "set:abcd1234",
                },
              ],
              description: "Canonical env values.",
              status: "ready",
              title: "Environment",
            },
            {
              checks: [
                {
                  key: "BASEBUDDY_CONTENT_DATABASE_URL",
                  label: "Content-plane database URL",
                  required: true,
                  status: "missing",
                  value: null,
                },
              ],
              description: "Content plane.",
              status: "missing",
              title: "Content-plane connectivity",
            },
          ],
        }}
      />,
    );

    confirmEnvStep();
    confirmSqlStep();
    confirmAuthStep();
    openStep(/step 5 check/i);

    expect(screen.getAllByText("Details")).toHaveLength(2);
    expect(screen.getByText("set:abcd1234")).not.toBeVisible();
    expect(screen.getByRole("heading", { name: "Content connection" })).toBeInTheDocument();
    expect(screen.getByText(/1 setup item needs attention/i)).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("BaseBuddy setup report")),
    ).toBeInTheDocument();
    expect(screen.queryByText(/control-plane/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/content-plane/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Missing").length).toBeGreaterThan(0);
  });
});
