import { describe, expect, it, vi } from "vitest";

import type { ContentPost } from "@/lib/content-runtime/shared";
import { createPostEditorPreviewStorage } from "@/lib/editor/post-editor-preview";

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
  excerpt: "Short summary",
  focusKeyword: null,
  id: "post-1",
  featuredImageUrl: null,
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello-world",
  status: "draft",
  tagIds: [],
  title: "Hello world",
  updatedAt: "2026-03-12T10:00:00.000Z",
  customFields: {},
  ...overrides,
});

const createMemoryLocalStorage = () => {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    get length() {
      return entries.size;
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
};

describe("post editor preview storage", () => {
  it("writes a preview snapshot and reads it back by token", () => {
    const localStorage = createMemoryLocalStorage();
    const previewStorage = createPostEditorPreviewStorage(localStorage);
    const token = previewStorage.writeSnapshot({
      hasUnsavedChanges: true,
      post: createPost(),
      projectName: "BaseBuddy",
      projectSlug: "basebuddy",
    });

    expect(previewStorage.createPreviewUrl(token)).toBe(`/content-preview?token=${encodeURIComponent(token)}`);
    expect(previewStorage.readSnapshot(token)).toMatchObject({
      hasUnsavedChanges: true,
      post: {
        slug: "hello-world",
        title: "Hello world",
      },
      projectName: "BaseBuddy",
      projectSlug: "basebuddy",
      version: 1,
    });
  });

  it("prunes expired preview snapshots before writing a new one", () => {
    const localStorage = createMemoryLocalStorage();
    const staleSnapshot = JSON.stringify({
      hasUnsavedChanges: false,
      post: createPost({ id: "post-stale" }),
      previewedAt: "2026-03-10T08:00:00.000Z",
      projectName: "BaseBuddy",
      projectSlug: "basebuddy",
      version: 1,
    });
    const freshSnapshot = JSON.stringify({
      hasUnsavedChanges: false,
      post: createPost({ id: "post-fresh" }),
      previewedAt: "2026-03-12T10:00:00.000Z",
      projectName: "BaseBuddy",
      projectSlug: "basebuddy",
      version: 1,
    });

    localStorage.setItem("content-runtime:post-preview:stale", staleSnapshot);
    localStorage.setItem("content-runtime:post-preview:fresh", freshSnapshot);

    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-03-12T12:00:00.000Z").getTime());

    try {
      const previewStorage = createPostEditorPreviewStorage(localStorage);
      const token = previewStorage.writeSnapshot({
        hasUnsavedChanges: false,
        post: createPost({ id: "post-new" }),
        projectName: "BaseBuddy",
        projectSlug: "basebuddy",
      });

      expect(localStorage.getItem("content-runtime:post-preview:stale")).toBeNull();
      expect(localStorage.getItem("content-runtime:post-preview:fresh")).toBe(freshSnapshot);
      expect(previewStorage.readSnapshot(token)?.post.id).toBe("post-new");
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
