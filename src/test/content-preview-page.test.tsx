import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentPost } from "@/lib/content-runtime/shared";
import { createPostEditorPreviewStorage } from "@/lib/editor/post-editor-preview";

const { searchParamsMock } = vi.hoisted(() => ({
  searchParamsMock: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock,
}));

const createPost = (overrides?: Partial<ContentPost>): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Hello world</p>",
  contentJson: {
    content: [],
    type: "doc",
  },
  contentMarkdown: null,
  createdAt: "2026-03-12T10:00:00.000Z",
  customFields: {},
  excerpt: "Short summary",
  featuredImageUrl: null,
  focusKeyword: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello-world",
  status: "draft",
  tagIds: [],
  title: "Hello world",
  updatedAt: "2026-03-12T10:00:00.000Z",
  ...overrides,
});

describe("ContentPreviewPage", () => {
  it("sanitizes preview HTML before rendering it", async () => {
    const previewStorage = createPostEditorPreviewStorage(window.localStorage);
    const token = previewStorage.writeSnapshot({
      hasUnsavedChanges: true,
      post: createPost({
        contentHtml: '<p>Hello preview</p><script>alert("xss")</script><img src="x" onerror="alert(1)">',
      }),
      projectName: "Demo Project",
      projectSlug: "demo-project",
    });
    searchParamsMock.set("token", token);

    const ContentPreviewPage = (await import("@/app/content-preview/page")).default;

    render(<ContentPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText("Hello preview")).toBeInTheDocument();
    });

    expect(document.querySelector(".preview-content script")).toBeNull();
    expect(document.querySelector(".preview-content [onerror]")).toBeNull();
  });
});
