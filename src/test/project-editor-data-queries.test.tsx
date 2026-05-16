import React, { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PostsPagePayload,
  WorkspacePayload,
} from "@/components/editor/project-editor/types";
import {
  fetchProjectEditorWorkspace,
  fetchProjectEditorRelationOptions,
  fetchProjectAuthorsManagerPage,
  fetchProjectEditorAuthorsPage,
  fetchProjectEditorCategoriesPage,
  fetchProjectEditorFilesLibrary,
  fetchProjectEditorMappingDetection,
  fetchProjectEditorMappingTableCatalog,
  fetchProjectEditorMediaLibrary,
  fetchProjectEditorStoredMapping,
  fetchProjectEditorTagsPage,
  primeProjectEditorPostPayloadQueryData,
  projectEditorQueryKeys,
  useProjectEditorPostPayloadQuery,
  useProjectEditorPostsPageQuery,
  useProjectEditorWorkspaceQuery,
} from "@/components/editor/project-editor/queries";
import {
  createDefaultContentPostSidebarConfig,
  type ContentPostEditorPayload,
} from "@/lib/content-runtime/shared";

const createWorkspacePayload = (): WorkspacePayload => ({
  capabilities: {
    canManageAuthors: true,
    canManageTaxonomy: true,
  },
  counts: {
    authors: 1,
    categories: 2,
    files: 0,
    media: 0,
    posts: 3,
    tags: 4,
  },
  contentRuntime: null,
  postSidebarConfig: createDefaultContentPostSidebarConfig(),
  primaryContentFormat: "html",
  workspaceState: "ready",
  workspaceSummary: {
    counts: {
      authors: 1,
      categories: 2,
      files: 0,
      media: 0,
      posts: 3,
      tags: 4,
    },
    isDerived: false,
    isExact: true,
    pendingCollections: [],
    refreshedAt: "2026-03-27T12:00:00.000Z",
  },
});

const createPostsPagePayload = (page: number): PostsPagePayload => ({
  authors: [],
  categories: [],
  editorOptionsState: "warm",
  pagination: {
    hasNextPage: page === 1,
    hasPreviousPage: page > 1,
    page,
    pageSize: 10,
    totalItems: 12,
    totalItemsExact: true,
    totalPages: 2,
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
      excerpt: `Excerpt ${page}`,
      focusKeyword: null,
      featuredImageUrl: null,
      id: `post-${page}`,
      publishedAt: null,
      redirects: [],
      seoDescription: null,
      seoTitle: null,
      slug: `post-${page}`,
      status: "draft",
      tagIds: [],
      title: `Post ${page}`,
      updatedAt: "2026-03-27T01:00:00.000Z",
    },
  ],
  tags: [],
});

const createMediaLibrary = () => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "cms-assets",
  canManage: true,
  currentPath: "",
  folderOptions: [""],
  folders: [],
  images: [],
  search: "",
  urlExpiresAt: "2026-04-01T00:00:00.000Z",
});

const createFilesLibrary = () => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "cms-assets",
  canManage: true,
  currentPath: "",
  fileCount: 0,
  files: [],
  folderOptions: [""],
  folders: [],
  search: "",
  urlExpiresAt: "2026-04-01T00:00:00.000Z",
});

const createProjectMappingPayload = () => ({
  bindingStatus: "draft",
  mappingConfig: {},
  revisionId: null,
  revisionVersion: null,
});

const createPostPayload = (): ContentPostEditorPayload => ({
  authors: [],
  categories: [],
  editorOptionsState: "full",
  post: {
    authorId: null,
    categoryIds: [],
    contentFields: {},
    contentFormat: "html",
    contentHtml: "<p>Hello</p>",
    contentJson: { type: "doc" },
    contentMarkdown: null,
    createdAt: "2026-03-27T00:00:00.000Z",
    customFields: {},
    excerpt: null,
    focusKeyword: null,
    featuredImageUrl: null,
    id: "post-1",
    publishedAt: null,
    redirects: [],
    seoDescription: null,
    seoTitle: null,
    slug: "post-1",
    status: "draft",
    tagIds: [],
    title: "Post 1",
    updatedAt: "2026-03-27T01:00:00.000Z",
  },
  tags: [],
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const createWrapper =
  (queryClient: QueryClient) =>
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

const createJsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project editor data queries", () => {
  it("requests the boot workspace payload from the dedicated workspace route", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse(createWorkspacePayload()),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProjectEditorWorkspace("project-1")).resolves.toMatchObject({
      workspaceState: "ready",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/content/workspace",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("serves the initial workspace payload without an immediate refetch", () => {
    const queryClient = createQueryClient();
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(
      () =>
        useProjectEditorWorkspaceQuery({
          initialData: createWorkspacePayload(),
          projectId: "project-1",
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    expect(result.current.data?.workspaceState).toBe("ready");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests mapping detection for a manually selected table", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        candidates: {
          authors: [],
          categories: [],
          files: [],
          media: [],
          posts: [],
          tags: [],
        },
        generatedAt: "2026-04-21T00:00:00.000Z",
        suggestedMappingConfig: {
          entities: {
            authors: {},
            categories: {},
            files: {},
            media: {},
            posts: {},
            tags: {},
          },
        },
        tables: [],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectEditorMappingDetection("project-1", {
      tableRef: "public.posts",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/content?view=mapping_detection&tableRef=public.posts",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("requests the mapping table catalog from the dedicated catalog view", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        tables: [
          {
            columnCount: 12,
            kind: "table",
            primaryKey: "id",
            rowCountEstimate: 42,
            schema: "public",
            table: "posts",
            tableRef: "public.posts",
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProjectEditorMappingTableCatalog("project-1")).resolves.toEqual([
      expect.objectContaining({
        tableRef: "public.posts",
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/content?view=mapping_tables",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("keeps the previous posts page as placeholder data while the next page loads", async () => {
    const queryClient = createQueryClient();
    const pageOnePayload = createPostsPagePayload(1);
    const pageTwoPayload = createPostsPagePayload(2);
    let resolvePageTwoRequest: ((response: Response) => void) | null = null;

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse(pageOnePayload))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolvePageTwoRequest = resolve;
          }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ page }) =>
        useProjectEditorPostsPageQuery({
          page,
          pageSize: 10,
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
      expect(result.current.data?.pagination.page).toBe(1);
    });

    rerender({ page: 2 });

    expect(result.current.data?.pagination.page).toBe(1);
    expect(result.current.isPlaceholderData).toBe(true);

    resolvePageTwoRequest?.(createJsonResponse(pageTwoPayload));

    await waitFor(() => {
      expect(result.current.data?.pagination.page).toBe(2);
    });
  });

  it("primes the post query cache for a specific post payload", () => {
    const queryClient = createQueryClient();
    const payload = createPostPayload();

    primeProjectEditorPostPayloadQueryData(queryClient, {
      payload,
      projectId: "project-1",
    });

    expect(
      queryClient.getQueryData<ContentPostEditorPayload>(
        projectEditorQueryKeys.post({
          includeEditorOptions: true,
          postId: payload.post.id,
          projectId: "project-1",
        }),
      ),
    ).toEqual(payload);
  });

  it("uses the primed shell post payload while the full editor payload is still loading", async () => {
    const queryClient = createQueryClient();
    const shellPayload = {
      ...createPostPayload(),
      editorOptionsState: "warm",
    } satisfies ContentPostEditorPayload;
    let resolveFullPayloadRequest: ((response: Response) => void) | null = null;

    primeProjectEditorPostPayloadQueryData(queryClient, {
      payload: shellPayload,
      projectId: "project-1",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFullPayloadRequest = resolve;
          }),
      ),
    );

    const { result } = renderHook(
      () =>
        useProjectEditorPostPayloadQuery({
          includeEditorOptions: true,
          postId: "post-1",
          projectId: "project-1",
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    expect(result.current.data?.post.id).toBe("post-1");
    expect(result.current.data?.editorOptionsState).toBe("warm");
    expect(result.current.isPlaceholderData).toBe(true);

    resolveFullPayloadRequest?.(createJsonResponse(createPostPayload()));

    await waitFor(() => {
      expect(result.current.data?.editorOptionsState).toBe("full");
    });
  });

  it("requests categories pages without the full hierarchy payload by default", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        items: [],
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalItemsExact: true,
          totalPages: 1,
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectEditorCategoriesPage({
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/content/categories?includeAllCategories=false&page=1&pageSize=10",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("requests tags pages from the dedicated tags route", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        items: [],
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalItemsExact: true,
          totalPages: 1,
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectEditorTagsPage({
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/content/tags?page=1&pageSize=10",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("requests authors pages from the dedicated authors route", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        items: [],
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalItemsExact: true,
          totalPages: 1,
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectEditorAuthorsPage({
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/content/authors?page=1&pageSize=10",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("requests relation options from the dedicated relation options view", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse([{ id: "tag-1", label: "Launch" }]),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchProjectEditorRelationOptions({
        fieldKey: "tags",
        limit: 25,
        projectId: "project-1",
        search: "lau",
      }),
    ).resolves.toEqual([{ id: "tag-1", label: "Launch" }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/content?view=relation_options&fieldKey=tags&search=lau&limit=25",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("requests authors-manager pages through the shared query contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        authors: [],
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 1,
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectAuthorsManagerPage({
      includeMeta: false,
      page: 1,
      pageSize: 20,
      projectId: "project-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/project-1/authors?page=1&pageSize=20&includeMeta=false"),
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("requests media manager payloads through the shared query contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse(createMediaLibrary()),
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectEditorMediaLibrary({
      path: "hero",
      projectId: "project-1",
      search: " cover ",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/media?includeFolderOptions=false&path=hero&search=cover",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("requests files manager payloads through the shared query contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse(createFilesLibrary()),
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectEditorFilesLibrary({
      path: "docs",
      projectId: "project-1",
      search: " spec ",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/files?includeFolderOptions=false&path=docs&search=spec",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("retries transient degraded-state failures when loading the media library", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error:
              "BaseBuddy is having trouble reaching this project's content right now. Try again in a few seconds.",
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            status: 503,
          },
        ),
      )
      .mockResolvedValueOnce(createJsonResponse(createMediaLibrary()));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchProjectEditorMediaLibrary({
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      bucketName: "cms-assets",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient mapping fetch failures before surfacing an error", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Could not load mapping data right now.",
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            status: 500,
          },
        ),
      )
      .mockResolvedValueOnce(createJsonResponse(createProjectMappingPayload()));

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProjectEditorStoredMapping("project-1")).resolves.toMatchObject({
      bindingStatus: "draft",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("times out hung mapping-detection requests instead of waiting forever", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;

      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const detectionPromise = fetchProjectEditorMappingDetection("project-1");
    const detectionExpectation = expect(detectionPromise).rejects.toThrow(
      "Could not load the detected mapping right now. The request timed out.",
    );

    await vi.advanceTimersByTimeAsync(61_000);

    await detectionExpectation;
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  }, 10_000);
});
