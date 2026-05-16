import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  acquireContentPostEditSessionMock,
  archiveContentPostMock,
  createContentCollectionEntryMock,
  deleteContentPostsMock,
  enforceRateLimitMock,
  publishContentPostMock,
  unpublishContentPostMock,
  updateContentCollectionEntryMock,
  updateContentPostMock,
  withAuthenticatedProjectRouteMock,
} = vi.hoisted(() => ({
  acquireContentPostEditSessionMock: vi.fn(),
  archiveContentPostMock: vi.fn(),
  createContentCollectionEntryMock: vi.fn(),
  deleteContentPostsMock: vi.fn(),
  enforceRateLimitMock: vi.fn(() => null),
  publishContentPostMock: vi.fn(),
  unpublishContentPostMock: vi.fn(),
  updateContentCollectionEntryMock: vi.fn(),
  updateContentPostMock: vi.fn(),
  withAuthenticatedProjectRouteMock: vi.fn(
    (
      handler: (
        request: Request,
        context: { projectId: string; user: { id: string } },
      ) => Promise<Response>,
    ) =>
      (request: Request, _routeContext: { params: Promise<{ projectId: string }> }) =>
        handler(request, {
          projectId: "project-1",
          user: { id: "user-1" },
        }),
  ),
}));

vi.mock("@/lib/api/project-api-auth", () => ({
  withAuthenticatedProjectRoute: withAuthenticatedProjectRouteMock,
}));

vi.mock("@/lib/api/request-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/request-guards")>(
    "@/lib/api/request-guards",
  );

  return {
    ...actual,
    enforceRateLimit: enforceRateLimitMock,
  };
});

vi.mock("@/lib/content-runtime/server", () => ({
  acquireContentPostEditSession: acquireContentPostEditSessionMock,
  createContentCollectionEntry: createContentCollectionEntryMock,
  createContentPost: vi.fn(),
  deleteContentCollectionEntries: vi.fn(),
  deleteContentPosts: deleteContentPostsMock,
  discardContentPost: vi.fn(),
  archiveContentPost: archiveContentPostMock,
  getContentAuthorsPage: vi.fn(),
  getContentCategoriesPage: vi.fn(),
  getContentMediaPage: vi.fn(),
  getContentPostEditorPayload: vi.fn(),
  getContentPostRevisions: vi.fn(),
  getContentPostsPage: vi.fn(),
  getContentPostsPresence: vi.fn(),
  getContentProjectFilesStorageCredentialStatus: vi.fn(),
  getContentProjectMapping: vi.fn(),
  getContentProjectMappingDetection: vi.fn(),
  getContentProjectMediaStorageCredentialStatus: vi.fn(),
  getContentProjectSupabaseStorageBuckets: vi.fn(),
  getStoredContentProjectMapping: vi.fn(),
  getContentTagsPage: vi.fn(),
  getContentWorkspaceMeta: vi.fn(),
  getContentWorkspaceSummary: vi.fn(),
  heartbeatContentPostEditSession: vi.fn(),
  publishContentPost: publishContentPostMock,
  releaseContentPostEditSession: vi.fn(),
  restoreContentPostRevision: vi.fn(),
  saveContentMappingRevision: vi.fn(),
  unpublishContentPost: unpublishContentPostMock,
  updateContentCollectionEntry: updateContentCollectionEntryMock,
  updateContentPost: updateContentPostMock,
}));

import { POST as postContentRoute } from "@/app/api/projects/[projectId]/content/route";
import { createContentAdapterOperationError } from "@/lib/content-runtime/adapter/error-mapping";

const buildJsonRequest = (body: unknown) =>
  new Request("http://localhost/api/projects/project-1/content", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

describe("content route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    enforceRateLimitMock.mockReturnValue(null);
    archiveContentPostMock.mockResolvedValue({ id: "post-1", status: "archived" });
    publishContentPostMock.mockResolvedValue({ id: "post-1", status: "published" });
    unpublishContentPostMock.mockResolvedValue({ id: "post-1", status: "draft" });
    updateContentPostMock.mockResolvedValue({ id: "post-1" });
    acquireContentPostEditSessionMock.mockResolvedValue({ success: true });
    createContentCollectionEntryMock.mockResolvedValue({ id: "entry-1" });
    updateContentCollectionEntryMock.mockResolvedValue({ id: "entry-1" });
    deleteContentPostsMock.mockResolvedValue(undefined);
  });

  it("accepts long post metadata and large taxonomy selections when updating a post", async () => {
    const longUrl = `https://example.com/${"image/".repeat(350)}`;
    const taxonomyIds = Array.from({ length: 101 }, (_, index) => `entry-${index}`);
    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        categoryIds: taxonomyIds,
        excerpt: "e".repeat(10_001),
        featuredImageUrl: longUrl,
        focusKeyword: "k".repeat(121),
        postId: "post-1",
        seoDescription: "d".repeat(501),
        seoTitle: "s".repeat(301),
        slug: "slug-".repeat(41),
        tagIds: taxonomyIds,
        title: "t".repeat(301),
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryIds: taxonomyIds,
        excerpt: "e".repeat(10_001),
        featuredImageUrl: longUrl,
        focusKeyword: "k".repeat(121),
        postId: "post-1",
        seoDescription: "d".repeat(501),
        seoTitle: "s".repeat(301),
        slug: "slug-".repeat(41),
        tagIds: taxonomyIds,
        title: "t".repeat(301),
      }),
    );
  });

  it("accepts published and updated timestamps when updating a post", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        postId: "post-1",
        publishedAt: "2026-03-31T09:30:00.000Z",
        updatedAt: "2026-03-31T10:45:00.000Z",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-1",
        publishedAt: "2026-03-31T09:30:00.000Z",
        updatedAt: "2026-03-31T10:45:00.000Z",
      }),
    );
  });

  it("accepts parent page ids when updating a post", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        parentPageId: "post-parent",
        postId: "post-1",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parentPageId: "post-parent",
        postId: "post-1",
      }),
    );
  });

  it("accepts redirects when updating a post", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        postId: "post-1",
        redirects: ["old-post", "older-post"],
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-1",
        redirects: ["old-post", "older-post"],
      }),
    );
  });

  it("accepts structured redirect rows when updating a post", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        postId: "post-1",
        redirects: [
          {
            active: true,
            locale: "en",
            source: "old-post",
            statusCode: 301,
          },
          {
            active: false,
            source: "older-post",
          },
        ],
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-1",
        redirects: [
          {
            active: true,
            locale: "en",
            source: "old-post",
            statusCode: 301,
          },
          {
            active: false,
            source: "older-post",
          },
        ],
      }),
    );
  });

  it("routes publish actions through the dedicated publish post server action", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "publish_post",
        postId: "post-1",
        publishedAt: "2026-03-31T09:30:00.000Z",
        title: "Hello",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(publishContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-1",
        projectId: "project-1",
        publishedAt: "2026-03-31T09:30:00.000Z",
        title: "Hello",
      }),
    );
    expect(updateContentPostMock).not.toHaveBeenCalled();
  });

  it("returns structured adapter errors for invalid post saves", async () => {
    updateContentPostMock.mockRejectedValueOnce(
      createContentAdapterOperationError([
        {
          code: "uniqueness_violation",
          fieldKey: "slug",
          message: "A unique value is already in use.",
          metadata: {
            constraint: "posts_slug_key",
            postgresCode: "23505",
          },
        },
      ]),
    );

    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        postId: "post-1",
        slug: "hello",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "A unique value is already in use.",
      errors: [
        {
          code: "uniqueness_violation",
          fieldKey: "slug",
          message: "A unique value is already in use.",
          metadata: {
            constraint: "posts_slug_key",
            postgresCode: "23505",
          },
        },
      ],
    });
  });

  it("returns 409 conflict responses for stale post saves", async () => {
    updateContentPostMock.mockRejectedValueOnce(
      createContentAdapterOperationError([
        {
          code: "stale_row_conflict",
          fieldKey: "updatedAt",
          message: "This post has changed since you loaded it. Reload and try again.",
          metadata: {
            currentUpdatedAt: "2026-03-31T10:46:00.000Z",
            expectedUpdatedAt: "2026-03-31T10:45:00.000Z",
          },
        },
      ]),
    );

    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        postId: "post-1",
        title: "Hello",
        updatedAt: "2026-03-31T10:45:00.000Z",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This post has changed since you loaded it. Reload and try again.",
      errors: [
        {
          code: "stale_row_conflict",
          fieldKey: "updatedAt",
          message: "This post has changed since you loaded it. Reload and try again.",
          metadata: {
            currentUpdatedAt: "2026-03-31T10:46:00.000Z",
            expectedUpdatedAt: "2026-03-31T10:45:00.000Z",
          },
        },
      ],
    });
  });

  it("returns 409 conflict responses for helper-row ambiguity during post saves", async () => {
    updateContentPostMock.mockRejectedValueOnce(
      createContentAdapterOperationError([
        {
          code: "helper_row_ambiguity",
          fieldKey: "author",
          message:
            "This field has duplicate source records. Ask an owner to fix the setup before editing it.",
          metadata: {
            helperRowCount: 2,
            values: ["author-1", "author-2"],
          },
        },
      ]),
    );

    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        authorId: "author-1",
        postId: "post-1",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This field has duplicate source records. Ask an owner to fix the setup before editing it.",
      errors: [
        {
          code: "helper_row_ambiguity",
          fieldKey: "author",
          message:
            "This field has duplicate source records. Ask an owner to fix the setup before editing it.",
          metadata: {
            helperRowCount: 2,
            values: ["author-1", "author-2"],
          },
        },
      ],
    });
  });

  it("routes archive actions through the dedicated archive post server action", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "archive_post",
        postId: "post-1",
        title: "Hello",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(archiveContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-1",
        projectId: "project-1",
        title: "Hello",
      }),
    );
  });

  it("routes unpublish actions through the dedicated unpublish post server action", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "unpublish_post",
        postId: "post-1",
        title: "Hello",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(unpublishContentPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-1",
        projectId: "project-1",
        title: "Hello",
      }),
    );
  });

  it("accepts long post titles for edit session acquisition", async () => {
    const postTitle = "A".repeat(301);
    const response = await postContentRoute(
      buildJsonRequest({
        action: "acquire_post_edit_session",
        postId: "post-1",
        postTitle,
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(acquireContentPostEditSessionMock).toHaveBeenCalledWith({
      force: false,
      postId: "post-1",
      postTitle,
      projectId: "project-1",
    });
  });

  it("accepts long collection create fields", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "create_collection_entry",
        collection: "categories",
        description: "d".repeat(10_001),
        name: "N".repeat(121),
        slug: "slug-".repeat(41),
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(createContentCollectionEntryMock).toHaveBeenCalledWith({
      collection: "categories",
      description: "d".repeat(10_001),
      name: "N".repeat(121),
      parentCategoryId: undefined,
      projectId: "project-1",
      slug: "slug-".repeat(41),
    });
  });

  it("accepts long author update fields", async () => {
    const email = `${"a".repeat(315)}@x.io`;
    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_collection_entry",
        bio: "b".repeat(10_001),
        collection: "authors",
        description: "d".repeat(10_001),
        email,
        entryId: "author-1",
        name: "N".repeat(121),
        slug: "slug-".repeat(41),
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateContentCollectionEntryMock).toHaveBeenCalledWith({
      bio: "b".repeat(10_001),
      collection: "authors",
      description: "d".repeat(10_001),
      email,
      entryId: "author-1",
      name: "N".repeat(121),
      parentCategoryId: undefined,
      projectId: "project-1",
      slug: "slug-".repeat(41),
    });
  });

  it("keeps the contentHtml cap for post mutations", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "update_post",
        contentHtml: "x".repeat(500_001),
        postId: "post-1",
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Some information is missing or invalid. Please review and try again.",
    });
  });

  it("keeps the delete_posts selection cap", async () => {
    const response = await postContentRoute(
      buildJsonRequest({
        action: "delete_posts",
        postIds: Array.from({ length: 51 }, (_, index) => `post-${index}`),
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Too many posts were selected.",
    });
    expect(deleteContentPostsMock).not.toHaveBeenCalled();
  });
});
