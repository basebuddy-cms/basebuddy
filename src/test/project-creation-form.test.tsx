import React, { type ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectCreationForm } from "@/components/projects/project-creation-form";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/projects/project-creation-hooks", () => ({
  useProjectCreationSlugState: () => ({
    detail: "This slug is available.",
    normalizedSlug: "demo-project",
    status: "available",
  }),
}));

describe("ProjectCreationForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
    window.sessionStorage.clear();
  });

  it("creates a project with only name and slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        redirectTo: "/projects/demo-project",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectCreationForm />);

    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: "Demo Project" },
    });
    fireEvent.change(screen.getByLabelText(/project address/i), {
      target: { value: "demo-project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
        body: JSON.stringify({
          projectName: "Demo Project",
          projectSlug: "demo-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects/demo-project");
    });
  });

  it("does not persist old onboarding drafts while creating projects", () => {
    window.sessionStorage.setItem(
      "basebuddy:onboarding-draft",
      JSON.stringify({
        projectName: "Recovered Project",
        projectSlug: "recovered-project",
        slugTouched: true,
      }),
    );

    render(<ProjectCreationForm />);

    expect(screen.getByLabelText(/project name/i)).toHaveValue("");
    expect(screen.getByLabelText(/project address/i)).toHaveValue("");
    expect(window.sessionStorage.getItem("basebuddy:onboarding-draft")).toBeNull();
    expect(window.sessionStorage.getItem("supapress:onboarding-draft")).toBeNull();
  });
});
