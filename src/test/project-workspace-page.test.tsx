import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/components/editor/project-editor", () => ({
  ProjectEditor: (props: Record<string, unknown>) => ({
    props,
    type: "ProjectEditor",
  }),
}));

const { getProjectPageBootstrapBySlugMock, prewarmContentProjectContextMock } = vi.hoisted(() => ({
  getProjectPageBootstrapBySlugMock: vi.fn(),
  prewarmContentProjectContextMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getProjectPageBootstrapBySlug: getProjectPageBootstrapBySlugMock,
}));

vi.mock("@/lib/content-runtime/server-project-context", () => ({
  prewarmContentProjectContext: prewarmContentProjectContextMock,
}));

describe("ProjectWorkspacePage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("prewarms the CMS project context during workspace bootstrap", async () => {
    getProjectPageBootstrapBySlugMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner User",
      },
      errorMessage: undefined,
      project: {
        id: "project-1",
        name: "Demo Project",
        role: "owner",
        slug: "demo-project",
        websiteUrl: null,
      },
      setupRequired: false,
    });

    const { ProjectWorkspacePage } = await import("@/components/editor/project-workspace-page");

    await ProjectWorkspacePage({
      projectSlug: "demo-project",
      requestedSection: "Posts",
    });

    expect(prewarmContentProjectContextMock).toHaveBeenCalledWith({
      projectId: "project-1",
      projectSlug: "demo-project",
    });
  });
});
