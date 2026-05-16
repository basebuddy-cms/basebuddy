import { describe, expect, it } from "vitest";

import type { ContentPost } from "@/lib/content-runtime/shared";
import {
  getCurrentPostAutosaveContext,
  hasComparableUnsavedPostChanges,
} from "@/hooks/post-editor-session/draft-state";
import { shouldUsePostEditorBrowserNavigationGuard } from "@/hooks/post-editor-session/effects";
import { isRecoverablePostSessionError } from "@/hooks/post-editor-session/session-transitions";

const createPost = (overrides: Partial<ContentPost> = {}): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p>Hello</p>",
  contentJson: {},
  contentMarkdown: null,
  createdAt: "2026-03-19T00:00:00.000Z",
  customFields: {},
  excerpt: null,
  featuredImageUrl: null,
  focusKeyword: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "hello",
  status: "draft",
  tagIds: [],
  title: "Hello",
  updatedAt: "2026-03-19T00:00:00.000Z",
  ...overrides,
});

const getComparablePostState = (post: ContentPost) => ({
  authorId: post.authorId,
  categoryIds: post.categoryIds,
  contentFields: post.contentFields,
  contentFormat: post.contentFormat,
  contentHtml: post.contentHtml,
  contentJson: post.contentJson,
  contentMarkdown: post.contentMarkdown,
  customFields: post.customFields,
  excerpt: post.excerpt,
  featuredImageUrl: post.featuredImageUrl,
  focusKeyword: post.focusKeyword,
  publishedAt: post.publishedAt,
  redirects: post.redirects,
  seoDescription: post.seoDescription,
  seoTitle: post.seoTitle,
  slug: post.slug,
  status: post.status,
  tagIds: post.tagIds,
  title: post.title,
  updatedAt: post.updatedAt,
});

describe("post editor session helpers", () => {
  it("detects unsaved changes when no persisted post exists yet", () => {
    const draftPost = createPost();

    expect(
      hasComparableUnsavedPostChanges({
        draftPost,
        getComparablePostState,
        isEditingSlug: false,
        persistedPost: null,
        slugDraft: draftPost.slug,
      }),
    ).toBe(true);
  });

  it("builds autosave context only for the posts editor route", () => {
    const draftPost = createPost();

    expect(
      getCurrentPostAutosaveContext({
        draftPosts: { [draftPost.id]: draftPost },
        getComparablePostState,
        isEditingSlug: false,
        persistedPosts: {},
        postContentView: "list",
        selectedCollection: "Posts",
        selectedPostId: draftPost.id,
        slugDraft: draftPost.slug,
      }),
    ).toBeNull();

    expect(
      getCurrentPostAutosaveContext({
        draftPosts: { [draftPost.id]: draftPost },
        getComparablePostState,
        isEditingSlug: false,
        persistedPosts: {},
        postContentView: "editor",
        selectedCollection: "Posts",
        selectedPostId: draftPost.id,
        slugDraft: draftPost.slug,
      }),
    ).toMatchObject({
      currentPostId: draftPost.id,
      hasUnsavedChanges: true,
    });
  });

  it("recognizes recoverable session error messages", () => {
    expect(isRecoverablePostSessionError("Another member is already working on this post.")).toBe(true);
    expect(isRecoverablePostSessionError("Editing access expired for this post.")).toBe(true);
    expect(isRecoverablePostSessionError("Unexpected failure while saving.")).toBe(false);
  });

  it("only enables the browser navigation guard after the post route is active", () => {
    expect(
      shouldUsePostEditorBrowserNavigationGuard({
        postContentView: "editor",
        routePostId: null,
        selectedCollection: "Posts",
        selectedPostId: "post-1",
      }),
    ).toBe(false);

    expect(
      shouldUsePostEditorBrowserNavigationGuard({
        postContentView: "editor",
        routePostId: "post-1",
        selectedCollection: "Posts",
        selectedPostId: "post-1",
      }),
    ).toBe(true);

    expect(
      shouldUsePostEditorBrowserNavigationGuard({
        postContentView: "list",
        routePostId: "post-1",
        selectedCollection: "Posts",
        selectedPostId: "post-1",
      }),
    ).toBe(false);
  });
});
