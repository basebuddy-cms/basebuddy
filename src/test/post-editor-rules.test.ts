import { describe, expect, it } from "vitest";

import type { ContentPost } from "@/lib/content-runtime/shared";
import { createDefaultEditorDoc } from "@/lib/content-runtime/shared";
import {
  getDisplayedPostSlug,
  hasManualUnsavedChanges,
  hasPublishablePostTitle,
  isDisposableContentPostDraft,
  resolvePostEditReadOnlyReason,
  resolvePostNavigationGuard,
  resolvePostLockHeartbeat,
  shouldKeepAutoSlugSynced,
  shouldRestoreLocalAutosave,
  type PostComparableState,
} from "@/lib/editor/post-editor-rules";

const basePost = (): PostComparableState => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p></p>",
  contentJson: { type: "doc" },
  contentMarkdown: null,
  customFields: {},
  excerpt: null,
  focusKeyword: null,
  featuredImageUrl: null,
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "untitled-7",
  status: "draft",
  tagIds: [],
  title: "",
  updatedAt: "2026-03-26T00:00:00.000Z",
});

const createPost = (overrides: Partial<ContentPost> = {}): ContentPost => ({
  authorId: null,
  categoryIds: [],
  contentFields: {},
  contentFormat: "html",
  contentHtml: "<p></p>",
  contentJson: createDefaultEditorDoc(),
  contentMarkdown: "",
  createdAt: "2026-03-26T00:00:00.000Z",
  customFields: {},
  excerpt: null,
  focusKeyword: null,
  featuredImageUrl: null,
  id: "post-1",
  publishedAt: null,
  redirects: [],
  seoDescription: null,
  seoTitle: null,
  slug: "untitled-abcd1234",
  status: "draft",
  tagIds: [],
  title: "",
  updatedAt: "2026-03-26T00:00:00.000Z",
  ...overrides,
});

describe("post editor rules", () => {
  it("shows the persisted slug for a fresh auto-managed untitled post", () => {
    expect(
      getDisplayedPostSlug({
        autoManaged: true,
        persistedSlug: "untitled-7",
        title: "",
      }),
    ).toBe("untitled-7");
  });

  it("mirrors the title into the slug preview while the slug is auto-managed", () => {
    expect(
      getDisplayedPostSlug({
        autoManaged: true,
        persistedSlug: "untitled-7",
        title: "Hello World",
      }),
    ).toBe("hello-world");
  });

  it("requires a non-empty title before publish is enabled", () => {
    expect(hasPublishablePostTitle("   ")).toBe(false);
    expect(hasPublishablePostTitle("Hello World")).toBe(true);
  });

  it("keeps save permission failures out of read-only mode, but still classifies session/access failures", () => {
    expect(
      resolvePostEditReadOnlyReason({
        message: "You do not have permission to edit posts in this project.",
        source: "save",
        status: 403,
      }),
    ).toBeNull();

    expect(
      resolvePostEditReadOnlyReason({
        message: "You do not have permission to edit posts in this project.",
        source: "acquire",
        status: 403,
      }),
    ).toBe("permission_lost");

    expect(
      resolvePostEditReadOnlyReason({
        message: "Post editing access expired.",
        source: "save",
      }),
    ).toBe("session_expired");

    expect(
      resolvePostEditReadOnlyReason({
        message: "Could not refresh editing access right now.",
        source: "heartbeat",
      }),
    ).toBe("refresh_failed");
  });

  it("keeps the saved slug once auto management stops", () => {
    expect(
      getDisplayedPostSlug({
        autoManaged: false,
        persistedSlug: "custom-slug",
        title: "Changed Title",
      }),
    ).toBe("custom-slug");
  });

  it("does not mark a pristine open/close as unsaved work", () => {
    const post = basePost();

    expect(
      hasManualUnsavedChanges({
        draft: post,
        isEditingSlug: false,
        persisted: post,
        slugDraft: post.slug,
      }),
    ).toBe(false);
  });

  it("marks title changes as unsaved work", () => {
    const persisted = basePost();
    const draft = {
      ...persisted,
      slug: "hello-world",
      title: "Hello World",
    };

    expect(
      hasManualUnsavedChanges({
        draft,
        isEditingSlug: false,
        persisted,
        slugDraft: draft.slug,
      }),
    ).toBe(true);
  });

  it("marks excerpt changes as unsaved work", () => {
    const persisted = basePost();
    const draft = {
      ...persisted,
      excerpt: "Short summary",
    };

    expect(
      hasManualUnsavedChanges({
        draft,
        isEditingSlug: false,
        persisted,
        slugDraft: draft.slug,
      }),
    ).toBe(true);
  });

  it("marks secondary content field changes as unsaved work", () => {
    const persisted = basePost();
    const draft = {
      ...persisted,
      contentFields: {
        body: {
          contentHtml: "<p>Updated body</p>",
          contentJson: {
            content: [
              {
                content: [{ text: "Updated body", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "doc",
          },
        },
      },
    };

    expect(
      hasManualUnsavedChanges({
        draft,
        isEditingSlug: false,
        persisted,
        slugDraft: draft.slug,
      }),
    ).toBe(true);
  });

  it("marks pending slug edits as unsaved work even before the slug is applied", () => {
    const post = basePost();

    expect(
      hasManualUnsavedChanges({
        draft: post,
        isEditingSlug: true,
        persisted: post,
        slugDraft: "custom-slug",
      }),
    ).toBe(true);
  });

  it("treats untouched generated drafts as disposable even when custom fields have defaults", () => {
    expect(
      isDisposableContentPostDraft(
        createPost({
          customFields: {
            locale: "en",
          },
        }),
      ),
    ).toBe(true);
  });

  it("keeps new drafts once they contain meaningful content", () => {
    expect(
      isDisposableContentPostDraft(
        createPost({
          title: "Hello World",
        }),
      ),
    ).toBe(false);

    expect(
      isDisposableContentPostDraft(
        createPost({
          featuredImageUrl: "https://example.com/image.png",
        }),
      ),
    ).toBe(false);
  });

  it("restores local autosave only after unexpected exits", () => {
    expect(
      shouldRestoreLocalAutosave({
        hasLocalAutosave: true,
        reason: "crash",
      }),
    ).toBe(true);

    expect(
      shouldRestoreLocalAutosave({
        hasLocalAutosave: true,
        reason: "discard",
      }),
    ).toBe(false);

    expect(
      shouldRestoreLocalAutosave({
        hasLocalAutosave: true,
        reason: "leave_without_saving",
      }),
    ).toBe(false);

    expect(
      shouldRestoreLocalAutosave({
        hasLocalAutosave: true,
        reason: "manual_save",
      }),
    ).toBe(false);
  });

  it("stops auto slug syncing after any explicit save or manual slug edit", () => {
    expect(
      shouldKeepAutoSlugSynced({
        autoManaged: true,
        event: "create",
      }),
    ).toBe(true);

    expect(
      shouldKeepAutoSlugSynced({
        autoManaged: true,
        event: "manual_save",
      }),
    ).toBe(false);

    expect(
      shouldKeepAutoSlugSynced({
        autoManaged: true,
        event: "manual_slug_save",
      }),
    ).toBe(false);
  });

  it("keeps editing when heartbeat has no blocker because the server heartbeat recovers session drift", () => {
    expect(
      resolvePostLockHeartbeat({
        active: false,
        blockingUserId: null,
      }),
    ).toBe("keep-editing");

    expect(
      resolvePostLockHeartbeat({
        active: false,
        blockingUserId: "user-123",
      }),
    ).toBe("show-takeover-dialog");
  });

  it("keeps editing when heartbeat confirms the lock is still active", () => {
    expect(
      resolvePostLockHeartbeat({
        active: true,
        blockingUserId: "user-123",
      }),
    ).toBe("keep-editing");
  });

  it("blocks repeat navigation while the confirmation dialog is already open", () => {
    expect(
      resolvePostNavigationGuard({
        hasPendingConfirmation: true,
        hasUnsavedChanges: true,
      }),
    ).toBe("block-navigation");
  });

  it("asks for confirmation only when unsaved work exists", () => {
    expect(
      resolvePostNavigationGuard({
        hasPendingConfirmation: false,
        hasUnsavedChanges: true,
      }),
    ).toBe("confirm-navigation");

    expect(
      resolvePostNavigationGuard({
        hasPendingConfirmation: false,
        hasUnsavedChanges: false,
      }),
    ).toBe("allow-navigation");
  });
});
