import React, { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostsPagePayload } from "@/components/editor/project-editor/types";
import {
  getProjectEditorPostsQueryCacheToken,
  projectEditorLocalCacheKeys,
  projectEditorLocalCachePrefixes,
  projectEditorMutationInvalidationTargets,
  projectEditorQueryFamilies,
  projectEditorQueryKeys,
  useProjectEditorPostRevisionsQuery,
  useProjectEditorPostsPageQuery,
} from "@/components/editor/project-editor/queries";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

const createPostsPagePayload = (postId: string): PostsPagePayload => ({
  authors: [],
  categories: [],
  editorOptionsState: "warm",
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    page: Number(postId.replace(/\D/g, "")) || 1,
    pageSize: 10,
    totalItems: 1,
    totalItemsExact: true,
    totalPages: 1,
  },
  posts: [
    {
      authorId: null,
      categoryIds: [],
      contentFields: {},
      contentFormat: "html",
      contentHtml: "",
      contentJson: {},
      contentMarkdown: null,
      createdAt: "2026-03-27T00:00:00.000Z",
      customFields: {},
      excerpt: null,
      focusKeyword: null,
      id: postId,
      featuredImageUrl: null,
      publishedAt: null,
      redirects: [],
      seoDescription: null,
      seoTitle: null,
      slug: postId,
      status: "draft",
      tagIds: [],
      title: `Post ${postId}`,
      updatedAt: "2026-03-27T00:00:00.000Z",
    },
  ],
  tags: [],
});

const createJsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project editor React Query hooks", () => {
  it("builds the same posts-page key for equivalent normalized query input", () => {
    expect(
      projectEditorQueryKeys.postsPage({
        page: 1,
        projectId: "project-1",
        search: "draft",
        sort: "updated_desc",
        status: "all",
      }),
    ).toEqual(
      projectEditorQueryKeys.postsPage({
        page: 1,
        projectId: "project-1",
        search: "draft",
        sort: "updated_desc",
        status: "all",
      }),
    );
  });

  it("includes cursor tokens in posts-page query keys", () => {
    expect(
      projectEditorQueryKeys.postsPage({
        cursor: "cursor-token",
        page: 2,
        projectId: "project-1",
        search: "",
        sort: "updated_desc",
        status: "all",
      }),
    ).toContain("cursor-token");
  });

  it("builds stable project query families for section-level invalidation", () => {
    expect(projectEditorQueryFamilies.project("project-1")).toEqual([
      "project-editor",
      "project-1",
    ]);
    expect(projectEditorQueryFamilies.postsPages("project-1")).toEqual([
      "project-editor",
      "project-1",
      "posts-page",
    ]);
    expect(projectEditorQueryFamilies.postsPresence("project-1")).toEqual([
      "project-editor",
      "project-1",
      "posts-presence",
    ]);
    expect(projectEditorQueryFamilies.workspace("project-1")).toEqual([
      "project-editor",
      "project-1",
      "workspace",
    ]);
    expect(projectEditorQueryFamilies.workspaceSummary("project-1")).toEqual([
      "project-editor",
      "project-1",
      "workspace-summary",
    ]);
    expect(projectEditorQueryFamilies.categoriesPages("project-1")).toEqual([
      "project-editor",
      "project-1",
      "categories-page",
    ]);
    expect(projectEditorQueryFamilies.authorsManagerPages("project-1")).toEqual([
      "project-editor",
      "project-1",
      "authors-manager-page",
    ]);
    expect(projectEditorQueryFamilies.mediaLibraries("project-1")).toEqual([
      "project-editor",
      "project-1",
      "media-library",
    ]);
    expect(projectEditorQueryFamilies.filesLibraries("project-1")).toEqual([
      "project-editor",
      "project-1",
      "files-library",
    ]);
  });

  it("builds stable persisted-cache prefixes for non-post editor sections", () => {
    expect(projectEditorLocalCachePrefixes.authorsManager("project-1", 2)).toBe(
      "content-runtime:project-1:authors-manager:v2:",
    );
    expect(projectEditorLocalCachePrefixes.mediaManager("project-1", 2)).toBe(
      "content-runtime:project-1:media-manager:v2:",
    );
    expect(projectEditorLocalCachePrefixes.filesManager("project-1", 1)).toBe(
      "content-runtime:project-1:files-manager:v1:",
    );
  });

  it("builds explicit post-level mutation targets for payload and revision caches", () => {
    expect(
      projectEditorMutationInvalidationTargets.post({
        postId: "post-1",
        projectId: "project-1",
      }),
    ).toEqual([
      projectEditorQueryKeys.post({
        includeEditorOptions: false,
        postId: "post-1",
        projectId: "project-1",
      }),
      projectEditorQueryKeys.post({
        includeEditorOptions: true,
        postId: "post-1",
        projectId: "project-1",
      }),
      projectEditorQueryKeys.postRevisions("project-1", "post-1"),
    ]);
  });

  it("builds stable local cache keys for collection snapshots and discardable posts", () => {
    expect(
      getProjectEditorPostsQueryCacheToken({
        search: "",
        sort: "updated_desc",
        status: "all",
      }),
    ).toBe("updated_desc:all:__all__");

    expect(
      getProjectEditorPostsQueryCacheToken({
        search: "hello world",
        sort: "updated_desc",
        status: "published",
      }),
    ).toBe("updated_desc:published:hello world");

    expect(
      projectEditorLocalCacheKeys.collectionSnapshot({
        collection: "Categories",
        page: 3,
        pageSize: 20,
        projectId: "project-1",
      }),
    ).toBe("content-runtime:project-1:Categories:3:20");

    expect(
      projectEditorLocalCacheKeys.collectionSnapshot({
        collection: "Posts",
        page: 1,
        pageSize: 10,
        postsQueryCacheToken: "updated_desc:all:none",
        projectId: "project-1",
      }),
    ).toBe("content-runtime:project-1:Posts:1:10:updated_desc:all:none");

    expect(projectEditorLocalCacheKeys.discardableNewPosts("project-1")).toBe(
      "content-runtime:project-1:discardable-new-posts",
    );
  });

  it("builds explicit mutation invalidation targets instead of relying on a broad project wipe", () => {
    expect(projectEditorQueryFamilies.posts("project-1")).toEqual([
      "project-editor",
      "project-1",
      "post",
    ]);
    expect(projectEditorQueryFamilies.postRevisions("project-1")).toEqual([
      "project-editor",
      "project-1",
      "post-revisions",
    ]);

    expect(projectEditorMutationInvalidationTargets.project("project-1")).toEqual([
      projectEditorQueryKeys.workspace("project-1"),
      projectEditorQueryKeys.workspaceSummary("project-1"),
      projectEditorQueryFamilies.postsPages("project-1"),
      projectEditorQueryKeys.postsPresence("project-1"),
      projectEditorQueryFamilies.posts("project-1"),
      projectEditorQueryFamilies.postRevisions("project-1"),
      projectEditorQueryFamilies.relationOptions("project-1"),
      projectEditorQueryFamilies.authorsPages("project-1"),
      projectEditorQueryFamilies.authorsManagerPages("project-1"),
      projectEditorQueryFamilies.categoriesPages("project-1"),
      projectEditorQueryFamilies.tagsPages("project-1"),
      projectEditorQueryFamilies.mediaLibraries("project-1"),
      projectEditorQueryFamilies.filesLibraries("project-1"),
      projectEditorQueryKeys.mappingDetection("project-1"),
    ]);

    expect(
      projectEditorMutationInvalidationTargets.collection({
        collection: "Authors",
        projectId: "project-1",
      }),
    ).toEqual([
      projectEditorQueryFamilies.authorsPages("project-1"),
      projectEditorQueryFamilies.authorsManagerPages("project-1"),
      projectEditorQueryFamilies.relationOptions("project-1", "author"),
    ]);
  });

  it("normalizes managed-storage search terms in media/files query keys", () => {
    expect(
      projectEditorQueryKeys.mediaLibrary({
        path: "hero",
        projectId: "project-1",
        search: " cover ",
      }),
    ).toEqual(
      projectEditorQueryKeys.mediaLibrary({
        path: "hero",
        projectId: "project-1",
        search: "cover",
      }),
    );

    expect(
      projectEditorQueryKeys.filesLibrary({
        path: "docs",
        projectId: "project-1",
        search: " spec ",
      }),
    ).toEqual(
      projectEditorQueryKeys.filesLibrary({
        path: "docs",
        projectId: "project-1",
        search: "spec",
      }),
    );
  });

  it("keeps the previous posts page as placeholder data while the next page is loading", async () => {
    let resolveSecondResponse: ((value: Response) => void) | null = null;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(createJsonResponse(createPostsPagePayload("post-1")))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondResponse = resolve;
          }),
      );

    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(
      ({ page }) =>
        useProjectEditorPostsPageQuery({
          enabled: true,
          page,
          projectId: "project-1",
          search: "",
          sort: "updated_desc",
          status: "all",
        }),
      {
        initialProps: { page: 1 },
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(result.current.data?.posts[0]?.id).toBe("post-1");
    });

    rerender({ page: 2 });

    expect(result.current.data?.posts[0]?.id).toBe("post-1");
    expect(result.current.isPlaceholderData).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveSecondResponse?.(createJsonResponse(createPostsPagePayload("post-2")));

    await waitFor(() => {
      expect(result.current.data?.posts[0]?.id).toBe("post-2");
    });
  });

  it("passes cursor tokens to the posts page API request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse(createPostsPagePayload("post-2")));

    const queryClient = createQueryClient();
    renderHook(
      () =>
        useProjectEditorPostsPageQuery({
          cursor: "cursor-token",
          enabled: true,
          page: 2,
          projectId: "project-1",
          search: "",
          sort: "updated_desc",
          status: "all",
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("cursor=cursor-token"),
        expect.any(Object),
      );
    });
  });

  it("keeps the revisions query disabled until a post id is available", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse({ revisions: [] }));

    const queryClient = createQueryClient();
    const { rerender } = renderHook(
      ({ postId }) =>
        useProjectEditorPostRevisionsQuery({
          enabled: Boolean(postId),
          postId,
          projectId: "project-1",
        }),
      {
        initialProps: { postId: null as string | null },
        wrapper: createWrapper(queryClient),
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ postId: "post-1" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
