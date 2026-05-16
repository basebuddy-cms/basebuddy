import { describe, expect, it, vi } from "vitest";

import {
  runProjectEditorPostSaveAndContinueAction,
  runProjectEditorPostSaveAction,
} from "@/components/editor/project-editor/post-save-action";
import type { ContentPost } from "@/lib/content-runtime/shared";

const createPost = (overrides: Partial<ContentPost> = {}): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "",
  contentJson: {},
  contentMarkdown: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  customFields: {},
  excerpt: null,
  featuredImageUrl: null,
  focusKeyword: null,
  id: "post-1",
  parentPageId: null,
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello",
  status: "draft",
  tagIds: [],
  title: "Hello",
  updatedAt: "2026-04-01T00:00:00.000Z",
  ...overrides,
});

describe("project editor post save action", () => {
  it("flushes dirty selected posts and reports success outside the editor shell", async () => {
    const post = createPost();
    const flushPostSave = vi.fn(async () => undefined);
    const toastSuccess = vi.fn();

    await runProjectEditorPostSaveAction({
      canEditCurrentPost: true,
      flushPostSave,
      getErrorMessage: (error, fallback) => (error instanceof Error ? error.message : fallback),
      getResolvedSelectedPostForSave: () => ({
        hasUnsavedChanges: true,
        post,
      }),
      isExpectedSessionError: () => false,
      toastError: vi.fn(),
      toastSuccess,
    });

    expect(flushPostSave).toHaveBeenCalledWith(post);
    expect(toastSuccess).toHaveBeenCalledWith("Changes saved.");
  });

  it("ignores clean, missing, or blocked posts", async () => {
    const flushPostSave = vi.fn(async () => undefined);

    await runProjectEditorPostSaveAction({
      canEditCurrentPost: false,
      flushPostSave,
      getErrorMessage: (_error, fallback) => fallback,
      getResolvedSelectedPostForSave: () => ({
        hasUnsavedChanges: true,
        post: createPost(),
      }),
      isExpectedSessionError: () => false,
      toastError: vi.fn(),
      toastSuccess: vi.fn(),
    });

    await runProjectEditorPostSaveAction({
      canEditCurrentPost: true,
      flushPostSave,
      getErrorMessage: (_error, fallback) => fallback,
      getResolvedSelectedPostForSave: () => ({
        hasUnsavedChanges: false,
        post: createPost(),
      }),
      isExpectedSessionError: () => false,
      toastError: vi.fn(),
      toastSuccess: vi.fn(),
    });

    expect(flushPostSave).not.toHaveBeenCalled();
  });

  it("saves dirty posts before continuing a pending navigation action", async () => {
    const post = createPost();
    const flushPostSave = vi.fn(async () => undefined);
    const continuePendingAction = vi.fn(async () => undefined);

    await runProjectEditorPostSaveAndContinueAction({
      canEditCurrentPost: true,
      continuePendingUnsavedChangesAction: continuePendingAction,
      flushPostSave,
      getErrorMessage: (error, fallback) => (error instanceof Error ? error.message : fallback),
      getResolvedSelectedPostForSave: () => ({
        hasUnsavedChanges: true,
        post,
      }),
      isExpectedSessionError: () => false,
      toastError: vi.fn(),
    });

    expect(flushPostSave).toHaveBeenCalledWith(post);
    expect(continuePendingAction).toHaveBeenCalledTimes(1);
  });
});
