import React, { type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("server-only", () => ({}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

describe("AppSetupNotice", () => {
  it("uses action-oriented setup copy without internal topology terms", async () => {
    const { AppSetupNotice } = await import("@/components/projects/app-setup-notice");

    render(<AppSetupNotice ctaHref="/onboarding" ctaLabel="Review setup" />);

    expect(screen.getByText(/basebuddy setup is incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/review setup/i)).toHaveAttribute("href", "/onboarding");
    expect(screen.queryByText(/control plane/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/content plane/i)).not.toBeInTheDocument();
  });
});
