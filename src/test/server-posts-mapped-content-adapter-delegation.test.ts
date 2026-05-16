import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethodMock,
  getCachedContentPostsCountMock,
  getMappedContentPostEditorPayloadMock,
  getMappedContentPostsPageMock,
  getCachedContentPostsQuerySnapshotMock,
  getContentPostsProjectionStateMock,
  getProjectPostAuthorAssignmentsMock,
  getProjectPostEditSessionsMock,
  getMappedContentRuntimeMock,
} = vi.hoisted(() => ({
  createContentRuntimeAdapterMock: vi.fn(),
  getRequiredContentRuntimeAdapterMethodMock: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
  getCachedContentPostsCountMock: vi.fn(),
  getMappedContentPostEditorPayloadMock: vi.fn(),
  getMappedContentPostsPageMock: vi.fn(),
  getCachedContentPostsQuerySnapshotMock: vi.fn(),
  getContentPostsProjectionStateMock: vi.fn(),
  getProjectPostAuthorAssignmentsMock: vi.fn(),
  getProjectPostEditSessionsMock: vi.fn(),
  getMappedContentRuntimeMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/permissions", () => ({
  canAccessAuthorScopedContent: vi.fn(() => true),
  getAccessibleAuthorIdsForAction: vi.fn(() => ["author-1"]),
  hasProjectContentPermission: vi.fn(() => true),
}));

vi.mock("@/lib/content-runtime/adapter/factory", () => ({
  createContentRuntimeAdapter: createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethod: getRequiredContentRuntimeAdapterMethodMock,
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

vi.mock("@/lib/content-runtime/server-post-edit-sessions", () => ({
  getProjectPostAuthorAssignments: getProjectPostAuthorAssignmentsMock,
  getProjectPostEditSessions: getProjectPostEditSessionsMock,
}));

vi.mock("@/lib/content-runtime/mapped-content-collections", () => ({
  loadMappedContentAuthors: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-content-post-projection", () => ({
  countContentPostsProjection: vi.fn(),
  getContentPostsProjectionPage: vi.fn(),
  getContentPostsProjectionState: getContentPostsProjectionStateMock,
  isMissingContentProjectionStorageError: vi.fn(() => false),
  listContentPostProjectionPreviews: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-content-post-projection-builder", () => ({
  refreshContentPostsProjection: vi.fn(),
}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  getMappedContentPostEditorPayload,
  getMappedContentPostsPage,
} from "@/lib/content-runtime/server-posts-mapped-content";

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
        fields: {
          title: { column: "title", kind: "text", label: "Title", path: null, required: true, visible: true },
        },
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

describe("server posts mapped-content adapter delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMappedContentRuntimeMock.mockReturnValue({
      authors: { source: { primaryKey: "id" } },
      posts: { relations: { authors: {} }, source: { primaryKey: "id" } },
    });
    getContentPostsProjectionStateMock.mockResolvedValue(null);
    getCachedContentPostsCountMock.mockResolvedValue(501);
    getProjectPostAuthorAssignmentsMock.mockResolvedValue(new Map());
    getProjectPostEditSessionsMock.mockResolvedValue(new Map());
  });

  it("uses adapter loadPostsPage for live mapped-content post pages", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const loadPostsPageMock = vi.fn().mockResolvedValue({
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
          createdAt: "2026-03-27T00:00:00.000Z",
          customFields: {},
          editorPayloadReady: false,
          excerpt: null,
          featuredImageUrl: null,
          focusKeyword: null,
          id: "adapter-post-1",
          publishedAt: null,
          seoDescription: null,
          seoTitle: null,
          slug: "adapter-post-1",
          status: "draft",
          tagIds: [],
          title: "Adapter Post 1",
          updatedAt: "2026-03-28T12:00:00.000Z",
        },
      ],
      tags: [],
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPostsPage: loadPostsPageMock,
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
        totalItemsExact: true,
        totalPages: 1,
      },
      posts: [],
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
        user: { id: "user-1" },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(async (_connectionString, handler) => handler(client)),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(loadPostsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleAuthorIds: null,
        client,
        page: 1,
        pageSize: 10,
        projectId: "project-1",
        search: "",
        sort: "updated_desc",
        status: "all",
        totalItems: undefined,
        useWindowPagination: true,
      }),
    );
    expect(getMappedContentPostsPageMock).not.toHaveBeenCalled();
    expect(page.posts[0]?.id).toBe("adapter-post-1");
  });

  it("does not build an unbounded preview snapshot for author-scoped live post pages", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const loadPostsPageMock = vi.fn().mockResolvedValue({
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
      posts: [],
      tags: [],
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPostsPage: loadPostsPageMock,
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
        user: { id: "user-1" },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => ["author-1"]),
        getPermissionError: vi.fn(() => "nope"),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(async (_connectionString, handler) => handler(client)),
      } as never,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
      search: "",
      sort: "updated_desc",
      status: "all",
    });

    expect(getCachedContentPostsQuerySnapshotMock).not.toHaveBeenCalled();
    expect(loadPostsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleAuthorIds: ["author-1"],
        page: 1,
        pageSize: 10,
      }),
    );
  });

  it("requires adapter loadPostsPage for live mapped-content post pages", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
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
        totalItemsExact: true,
        totalPages: 1,
      },
      posts: [],
      tags: [],
    });

    await expect(
      getMappedContentPostsPage({
        context: {
          connectionString: "postgresql://demo",
          memberAccess: {} as never,
          schemaOptions: {
            enableRevisions: true,
            enableRls: true,
            primaryContentFormat: "html",
          },
          user: { id: "user-1" },
        } as never,
        dependencies: {
          ensureContentPermission: vi.fn(() => null),
          getPermissionError: vi.fn(() => "nope"),
          getReadyContentProjectMapping: vi.fn(async () => mapping),
          withContentDatabaseClient: vi.fn(async (_connectionString, handler) => handler(client)),
        } as never,
        page: 1,
        pageSize: 10,
        projectId: "project-1",
        search: "",
        sort: "updated_desc",
        status: "all",
      }),
    ).rejects.toThrow('Mapped content adapter is missing required method "loadPostsPage".');

    expect(getMappedContentPostsPageMock).not.toHaveBeenCalled();
  });

  it("uses adapter loadPostEditorPayload for mapped-content post payloads", async () => {
    const bootstrapMapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const loadPostEditorPayloadMock = vi.fn().mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      post: {
        authorId: "author-1",
        categoryIds: [],
        contentFields: {},
        contentFormat: "html",
        contentHtml: "<p>Hello</p>",
        contentJson: { type: "doc" },
        contentMarkdown: null,
        createdAt: "2026-03-27T00:00:00.000Z",
        customFields: {},
        excerpt: null,
        featuredImageUrl: null,
        focusKeyword: null,
        id: "post-1",
        publishedAt: null,
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

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPostEditorPayload: loadPostEditorPayloadMock,
    });
    getMappedContentPostEditorPayloadMock.mockResolvedValue({
      authors: [],
      categories: [],
      editorOptionsState: "warm",
      post: {
        authorId: "author-1",
        categoryIds: [],
        contentFields: {},
        contentFormat: "html",
        contentHtml: "<p>Hello</p>",
        contentJson: { type: "doc" },
        contentMarkdown: null,
        createdAt: "2026-03-27T00:00:00.000Z",
        customFields: {},
        excerpt: null,
        featuredImageUrl: null,
        focusKeyword: null,
        id: "post-legacy-1",
        publishedAt: null,
        seoDescription: null,
        seoTitle: null,
        slug: "post-legacy-1",
        status: "draft",
        tagIds: [],
        title: "Legacy Post 1",
        updatedAt: "2026-03-27T01:00:00.000Z",
      },
      tags: [],
    });

    const payload = await getMappedContentPostEditorPayload({
      context: {
        connectionString: "postgresql://demo",
        memberAccess: {
          authorScopes: [],
          permissions: ["content.read", "content.write.all"],
          roles: ["owner"],
        } as never,
        projectId: "project-1",
        projectSlug: "demo-project",
        schemaOptions: {
          enableRevisions: true,
          primaryContentFormat: "html",
        },
        user: {
          id: "user-1",
        },
      } as never,
      dependencies: {
        ensureContentPermission: vi.fn(() => []),
        ensureDirectConnectionForMappedRuntime: vi.fn(),
        getBootstrapContentProjectMapping: vi.fn(async () => bootstrapMapping),
        getPermissionError: vi.fn(() => "forbidden"),
        getProjectContext: vi.fn(),
        getReadyContentProjectMapping: vi.fn(async () => {
          throw new Error("warm payload should not require repaired mapping");
        }),
        withContentDatabaseClient: vi.fn(async (_connectionString, handler) => handler(client)),
      },
      includeEditorOptions: false,
      postId: "post-1",
      projectId: "project-1",
    });

    expect(loadPostEditorPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleAuthorIds: ["author-1"],
        authorAssignmentsByAuthorId: null,
        client,
        includeEditorOptions: false,
        postId: "post-1",
        projectId: "project-1",
      }),
    );
    expect(getMappedContentPostEditorPayloadMock).not.toHaveBeenCalled();
    expect(payload.post.id).toBe("post-1");
  });
});
