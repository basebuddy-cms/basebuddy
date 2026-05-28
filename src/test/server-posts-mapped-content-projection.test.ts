import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  countContentPostsProjectionMock,
  getCachedContentPostsCountMock,
  getCachedContentPostsQuerySnapshotMock,
  getContentPostsProjectionPageMock,
  getMappedContentPostsPageMock,
  getContentPostsProjectionStateMock,
  getMappedContentRuntimeMock,
  listContentPostProjectionPreviewsMock,
  loadMappedContentAuthorsMock,
  refreshContentPostsProjectionMock,
} = vi.hoisted(() => ({
  countContentPostsProjectionMock: vi.fn(),
  getCachedContentPostsCountMock: vi.fn(),
  getCachedContentPostsQuerySnapshotMock: vi.fn(),
  getContentPostsProjectionPageMock: vi.fn(),
  getMappedContentPostsPageMock: vi.fn(),
  getContentPostsProjectionStateMock: vi.fn(),
  getMappedContentRuntimeMock: vi.fn(),
  listContentPostProjectionPreviewsMock: vi.fn(),
  loadMappedContentAuthorsMock: vi.fn(),
  refreshContentPostsProjectionMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/permissions", () => ({
  canAccessAuthorScopedContent: vi.fn(() => true),
  getAccessibleAuthorIdsForAction: vi.fn(() => []),
  hasProjectContentPermission: vi.fn(() => true),
}));


vi.mock("@/lib/content-runtime/mapped-content-runtime-support", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/mapped-content-runtime-support")>(
    "@/lib/content-runtime/mapped-content-runtime-support",
  );

  return {
    ...actual,
    getMappedContentRuntime: getMappedContentRuntimeMock,
  };
});

vi.mock("@/lib/content-runtime/server-posts-list-cache", () => ({
  getCachedContentPostsCount: getCachedContentPostsCountMock,
}));

vi.mock("@/lib/content-runtime/server-posts-query-cache", () => ({
  CONTENT_POSTS_QUERY_SNAPSHOT_MAX_ITEMS: 500,
  getCachedContentPostsQuerySnapshot: getCachedContentPostsQuerySnapshotMock,
}));

vi.mock("@/lib/content-runtime/server-runtime-cache-keys", () => ({
  getContentAccessScopeCacheSignature: vi.fn(() => "scope"),
}));

vi.mock("@/lib/content-runtime/server-posts-shared", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/server-posts-shared")>(
    "@/lib/content-runtime/server-posts-shared",
  );

  return {
    ...actual,
    assertContentPostEditSession: vi.fn(),
  };
});

vi.mock("@/lib/content-runtime/server-post-edit-sessions", () => ({
  getProjectPostAuthorAssignments: vi.fn(),
  getProjectPostEditSessions: vi.fn(),
}));

vi.mock("@/lib/content-runtime/mapped-content-collections", () => ({
  loadMappedContentAuthors: loadMappedContentAuthorsMock,
}));

vi.mock("@/lib/content-runtime/adapter/factory", () => ({
  createContentRuntimeAdapter: vi.fn(() => ({
    loadPostListAuthors: vi.fn(() => loadMappedContentAuthorsMock()),
    loadPostsPage: getMappedContentPostsPageMock,
  })),
  getRequiredContentRuntimeAdapterMethod: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
}));

vi.mock("@/lib/content-runtime/server-content-post-projection", () => ({
  countContentPostsProjection: countContentPostsProjectionMock,
  getContentPostsProjectionPage: getContentPostsProjectionPageMock,
  getContentPostsProjectionState: getContentPostsProjectionStateMock,
  isMissingContentProjectionStorageError: vi.fn(
    (error: { code?: string | null; message?: string | null } | null | undefined) =>
      error?.code === "42P01",
  ),
  listContentPostProjectionPreviews: listContentPostProjectionPreviewsMock,
}));

vi.mock("@/lib/content-runtime/server-content-post-projection-builder", () => ({
  refreshContentPostsProjection: refreshContentPostsProjectionMock,
}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import { getMappedContentPostsPage } from "@/lib/content-runtime/server-posts-mapped-content";

const createMappedContentMapping = (): ContentProjectMapping => ({
  bindingId: "binding-1",
  bindingMode: "mapped_content",
  bindingStatus: "ready",
  mappingConfig: {
    entities: {
      authors: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {},
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "authors" },
        status: "mapped",
        workflow: null,
      },
      categories: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {},
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "categories" },
        status: "mapped",
        workflow: null,
      },
      files: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {},
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "files" },
        status: "mapped",
        workflow: null,
      },
      media: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {},
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "media" },
        status: "mapped",
        workflow: null,
      },
      posts: {
        capabilities: { browse: true, create: true, delete: true, read: true, update: true },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {},
        notes: [],
        relations: {
          authors: {
            fieldMap: {},
            junctionSourceColumn: null,
            junctionTable: null,
            junctionTargetColumn: null,
            multiple: false,
            sourceColumn: "author_id",
            status: "mapped",
            strategy: "foreign_key",
            targetColumn: "id",
            targetEntity: "authors",
            targetTable: null,
            valueColumn: null,
          },
        },
        source: { kind: "table", primaryKey: "id", schema: "public", table: "posts" },
        status: "mapped",
        workflow: null,
      },
      tags: {
        capabilities: { browse: true, create: false, delete: false, read: true, update: false },
        companionContentColumns: [],
        customFields: [],
        editorFields: [],
        fields: {},
        notes: [],
        relations: {},
        source: { kind: "table", primaryKey: "id", schema: "public", table: "tags" },
        status: "mapped",
        workflow: null,
      },
    },
    filesStorage: null,
    mediaStorage: null,
    version: 1,
  },
  revisionId: "revision-1",
  revisionVersion: 7,
});

describe("server posts mapped projection cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMappedContentRuntimeMock.mockReturnValue({
      authors: { source: { primaryKey: "id" } },
      posts: { relations: { authors: {} }, source: { primaryKey: "id" } },
    });
    getContentPostsProjectionStateMock.mockResolvedValue({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      status: "ready",
      totalItems: 1,
    });
    countContentPostsProjectionMock.mockResolvedValue(1);
    getContentPostsProjectionPageMock.mockResolvedValue({
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalItemsExact: true,
        totalPages: 1,
      },
      posts: [
        {
          authorId: "author-1",
          categoryIds: [],
          contentFields: {},
          contentFormat: "html",
          contentHtml: "",
          contentJson: { content: [{ type: "paragraph" }], type: "doc" },
          contentMarkdown: null,
          createdAt: "2026-03-27T00:00:00.000Z",
          customFields: {},
          editorPayloadReady: false,
          excerpt: "Paged projection row",
          featuredImageUrl: null,
          focusKeyword: null,
          id: "post-projection-page",
          publishedAt: null,
          seoDescription: null,
          seoTitle: null,
          slug: "paged-projection-row",
          status: "draft",
          tagIds: [],
          title: "Paged Projection Row",
          updatedAt: "2026-03-28T12:00:00.000Z",
        },
      ],
    });
    getMappedContentPostsPageMock.mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalItemsExact: false,
        totalPages: 1,
      },
      posts: [
        {
          authorId: "author-1",
          categoryIds: [],
          contentFields: {},
          contentFormat: "html",
          contentHtml: "",
          contentJson: { content: [{ type: "paragraph" }], type: "doc" },
          contentMarkdown: null,
          createdAt: "2026-03-27T00:00:00.000Z",
          customFields: {},
          editorPayloadReady: false,
          excerpt: "Fallback row",
          featuredImageUrl: null,
          focusKeyword: null,
          id: "post-live-1",
          publishedAt: null,
          seoDescription: null,
          seoTitle: null,
          slug: "fallback-row",
          status: "draft",
          tagIds: [],
          title: "Fallback Row",
          updatedAt: "2026-03-28T12:00:00.000Z",
        },
      ],
      tags: [],
    });
    getCachedContentPostsCountMock.mockImplementation(async ({ load }) => load());
    getCachedContentPostsQuerySnapshotMock.mockImplementation(async ({ load }) => load());
    listContentPostProjectionPreviewsMock.mockResolvedValue([
      {
        authorId: "author-1",
        categoryIds: [],
        contentFields: {},
        contentFormat: "html",
        contentHtml: "",
        contentJson: { content: [{ type: "paragraph" }], type: "doc" },
        contentMarkdown: null,
        createdAt: "2026-03-27T00:00:00.000Z",
        customFields: {},
        editorPayloadReady: false,
        excerpt: "Launch notes",
        featuredImageUrl: null,
        focusKeyword: null,
        id: "post-1",
        publishedAt: null,
        seoDescription: null,
        seoTitle: null,
        slug: "hello-world",
        status: "draft",
        tagIds: [],
        title: "Hello World",
        updatedAt: "2026-03-28T12:00:00.000Z",
      },
    ]);
    loadMappedContentAuthorsMock.mockResolvedValue([
      {
        avatarUrl: null,
        bio: null,
        createdAt: "2026-03-27T00:00:00.000Z",
        email: null,
        id: "author-1",
        name: "Author One",
        slug: "author-one",
      },
    ]);
  });

  it("serves posts pages from the projection when a ready revision snapshot exists", async () => {
    const mapping = createMappedContentMapping();

    const page = await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(async (_connectionString: string, handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
          handler({
            query: vi.fn(),
          }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(getMappedContentPostsPageMock).not.toHaveBeenCalled();
    expect(listContentPostProjectionPreviewsMock).toHaveBeenCalled();
    expect(page.posts).toHaveLength(1);
    expect(page.posts[0]?.id).toBe("post-1");
    expect(page.authors[0]?.id).toBe("author-1");
  });

  it("falls back to the live mapped-schema path when projection storage is unavailable", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionPageMock.mockRejectedValueOnce({
      code: "42P01",
      message: `relation "private.${["basebuddy", "project", "content", "post", "previews"].join("_")}" does not exist`,
    });

    const page = await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => ["author-1"]),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(async (_connectionString: string, handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
          handler({
            query: vi.fn(),
          }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(getMappedContentPostsPageMock).toHaveBeenCalled();
    expect(getCachedContentPostsQuerySnapshotMock).not.toHaveBeenCalled();
    expect(page.posts[0]?.id).toBe("post-live-1");
  });

  it("falls back to the live mapped-schema path when the projection read fails for a non-storage reason", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionPageMock.mockRejectedValueOnce(
      new Error("Projection read failed unexpectedly."),
    );
    getMappedContentPostsPageMock.mockResolvedValueOnce({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalItemsExact: false,
        totalPages: 1,
      },
      posts: [
        {
          authorId: "author-1",
          categoryIds: [],
          contentFields: {},
          contentFormat: "html",
          contentHtml: "",
          contentJson: { content: [{ type: "paragraph" }], type: "doc" },
          contentMarkdown: null,
          createdAt: "2026-03-27T00:00:00.000Z",
          customFields: {},
          editorPayloadReady: false,
          excerpt: "Fallback row",
          featuredImageUrl: null,
          focusKeyword: null,
          id: "post-live-2",
          publishedAt: null,
          seoDescription: null,
          seoTitle: null,
          slug: "fallback-row-2",
          status: "draft",
          tagIds: [],
          title: "Fallback Row 2",
          updatedAt: "2026-03-28T12:00:00.000Z",
        },
      ],
      tags: [],
    });

    const page = await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => ["author-1"]),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(getMappedContentPostsPageMock).toHaveBeenCalled();
    expect(getCachedContentPostsQuerySnapshotMock).not.toHaveBeenCalled();
    expect(page.posts[0]?.id).toBe("post-live-2");
  });

  it("returns projection posts even when author meta loading fails", async () => {
    const mapping = createMappedContentMapping();
    loadMappedContentAuthorsMock.mockRejectedValueOnce(
      new Error("Could not load author metadata."),
    );

    const page = await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(page.posts).toHaveLength(1);
    expect(page.posts[0]?.id).toBe("post-1");
    expect(page.authors).toEqual([]);
  });

  it("uses projection state totals without exact count for large unfiltered post pages", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionStateMock.mockResolvedValueOnce({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      status: "ready",
      totalItems: 50_000,
    });

    const page = await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(getCachedContentPostsCountMock).not.toHaveBeenCalled();
    expect(countContentPostsProjectionMock).not.toHaveBeenCalled();
    expect(getContentPostsProjectionPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        totalItems: 50_000,
        useWindowPagination: false,
      }),
    );
    expect(page.posts[0]?.id).toBe("post-projection-page");
  });

  it("uses bounded window pagination for projection search instead of exact search counts", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionStateMock.mockResolvedValueOnce({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      status: "ready",
      totalItems: 50_000,
    });

    await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "launch",
      sort: "updated_desc",
      status: "all",
    });

    expect(getCachedContentPostsCountMock).not.toHaveBeenCalled();
    expect(countContentPostsProjectionMock).not.toHaveBeenCalled();
    expect(getContentPostsProjectionPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        totalItems: 50_000,
        useWindowPagination: true,
      }),
    );
  });

  it("uses bounded live search fallback without exact counts when projection is unavailable", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionStateMock.mockResolvedValueOnce(null);

    await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "launch",
      sort: "updated_desc",
      status: "all",
    });

    expect(getCachedContentPostsCountMock).not.toHaveBeenCalled();
    expect(getCachedContentPostsQuerySnapshotMock).not.toHaveBeenCalled();
    expect(getMappedContentPostsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "launch",
        totalItems: undefined,
        useWindowPagination: true,
      }),
    );
  });

  it("uses bounded live first-page fallback without exact counts when projection is unavailable", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionStateMock.mockResolvedValueOnce(null);

    await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(getCachedContentPostsCountMock).not.toHaveBeenCalled();
    expect(getCachedContentPostsQuerySnapshotMock).not.toHaveBeenCalled();
    expect(getMappedContentPostsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "",
        totalItems: undefined,
        useWindowPagination: true,
      }),
    );
  });

  it("does not wait for a background projection refresh before returning live posts", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionStateMock.mockResolvedValueOnce(null);
    let resolveRefresh: (value: { totalItems: number }) => void = () => {};
    const refreshPromise = new Promise<{ totalItems: number }>((resolve) => {
      resolveRefresh = resolve;
    });
    refreshContentPostsProjectionMock.mockReturnValueOnce(refreshPromise);
    getMappedContentPostsPageMock.mockImplementationOnce(async () => {
      expect(refreshContentPostsProjectionMock).not.toHaveBeenCalled();

      return {
        authors: [],
        categories: [],
        editorOptionsState: "warm",
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
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
            contentJson: { type: "doc" },
            contentMarkdown: null,
            createdAt: "2026-03-28T00:00:00.000Z",
            customFields: {},
            editorPayloadReady: false,
            excerpt: null,
            featuredImageUrl: null,
            focusKeyword: null,
            id: "post-live-1",
            publishedAt: null,
            seoDescription: null,
            seoTitle: null,
            slug: "post-live-1",
            status: "draft",
            tagIds: [],
            title: "Live Post",
            updatedAt: "2026-03-28T00:00:00.000Z",
          },
        ],
        tags: [],
      };
    });

    const page = await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "launch",
      sort: "updated_desc",
      status: "all",
    });

    expect(page.posts[0]?.id).toBe("post-live-1");
    expect(refreshContentPostsProjectionMock).toHaveBeenCalled();
    resolveRefresh({ totalItems: 1 });
    await refreshPromise;
  });

  it("marks the posts list index as warming while projection rows are still building", async () => {
    const mapping = createMappedContentMapping();
    getContentPostsProjectionStateMock.mockResolvedValueOnce({
      lastError: null,
      lastRefreshedAt: "2026-03-28T13:00:00.000Z",
      processedItems: 20,
      progressCursor: "post-20",
      status: "building",
      totalItems: 0,
    });

    const page = await getMappedContentPostsPage({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {} as never,
        schemaOptions: {
          enableRevisions: true,
          enableRls: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(
          async (
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>,
          ) =>
            handler({
              query: vi.fn(),
            }),
        ),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(page.postsListIndexState).toBe("warming");
    expect(page.posts[0]?.id).toBe("post-live-1");
    expect(refreshContentPostsProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mapping,
        projectId: "project-1",
      }),
    );
  });
});
