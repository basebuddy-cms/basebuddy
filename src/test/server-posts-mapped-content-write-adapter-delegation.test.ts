import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  assertContentPostEditSessionMock,
  createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethodMock,
  createMappedContentPostMock,
  refreshContentPostsProjectionMock,
  updateMappedContentPostMock,
} = vi.hoisted(() => ({
  assertContentPostEditSessionMock: vi.fn(),
  createContentRuntimeAdapterMock: vi.fn(),
  getRequiredContentRuntimeAdapterMethodMock: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
  createMappedContentPostMock: vi.fn(),
  refreshContentPostsProjectionMock: vi.fn(),
  updateMappedContentPostMock: vi.fn(),
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


vi.mock("@/lib/content-runtime/server-posts-shared", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/server-posts-shared")>(
    "@/lib/content-runtime/server-posts-shared",
  );

  return {
    ...actual,
    assertContentPostEditSession: assertContentPostEditSessionMock,
  };
});

vi.mock("@/lib/content-runtime/server-post-edit-sessions", () => ({
  getProjectPostAuthorAssignments: vi.fn(),
  getProjectPostEditSessions: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-content-post-projection-builder", () => ({
  refreshContentPostsProjection: refreshContentPostsProjectionMock,
}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  createMappedContentPost,
  updateMappedContentPost,
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

describe("server posts mapped-content write adapter delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshContentPostsProjectionMock.mockResolvedValue(undefined);
  });

  it("uses adapter createPost for mapped-content draft creation", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const createPostMock = vi.fn().mockResolvedValue({
      authorId: null,
      categoryIds: [],
      contentFields: {},
      contentFormat: "html",
      contentHtml: "",
      contentJson: { type: "doc" },
      contentMarkdown: null,
      createdAt: "2026-03-27T00:00:00.000Z",
      customFields: {},
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
      title: "",
      updatedAt: "2026-03-27T00:00:00.000Z",
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      createPost: createPostMock,
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });

    const post = await createMappedContentPost({
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
      projectId: "project-1",
    });

    expect(createPostMock).toHaveBeenCalledWith({
      accessibleAuthorIds: ["author-1"],
      client,
    });
    expect(createMappedContentPostMock).not.toHaveBeenCalled();
    expect(refreshContentPostsProjectionMock).toHaveBeenCalledWith({
      client,
      mapping,
      postIds: ["adapter-post-1"],
      projectId: "project-1",
    });
    expect(post.id).toBe("adapter-post-1");
  });

  it("uses adapter savePost for mapped-content post updates", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const savePostMock = vi.fn().mockResolvedValue({
      authorId: "author-1",
      categoryIds: [],
      contentFields: {},
      contentFormat: "html",
      contentHtml: "<p>Hello</p>",
      contentJson: { type: "doc" },
      contentMarkdown: null,
      createdAt: "2026-03-27T00:00:00.000Z",
      customFields: {},
      excerpt: "Excerpt",
      featuredImageUrl: null,
      focusKeyword: null,
      id: "post-1",
      publishedAt: null,
      seoDescription: null,
      seoTitle: null,
      slug: "post-1",
      status: "draft",
      tagIds: [],
      title: "Hello",
      updatedAt: "2026-03-27T01:00:00.000Z",
    });
    const loadPostMock = vi.fn().mockResolvedValue({
      authorId: "author-1",
      categoryIds: [],
      contentFields: {},
      contentFormat: "html",
      contentHtml: "<p>Old</p>",
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
      title: "Old",
      updatedAt: "2026-03-27T00:30:00.000Z",
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: loadPostMock,
      savePost: savePostMock,
    });

    const post = await updateMappedContentPost({
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
      excerpt: "Excerpt",
      postId: "post-1",
      projectId: "project-1",
      title: "Hello",
    });

    expect(assertContentPostEditSessionMock).toHaveBeenCalled();
    expect(loadPostMock).toHaveBeenCalledWith({
      client,
      postId: "post-1",
      projectId: "project-1",
    });
    expect(savePostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        excerpt: "Excerpt",
        postId: "post-1",
        title: "Hello",
      }),
    );
    expect(updateMappedContentPostMock).not.toHaveBeenCalled();
    expect(refreshContentPostsProjectionMock).toHaveBeenCalledWith({
      client,
      mapping,
      postIds: ["post-1"],
      projectId: "project-1",
    });
    expect(post.title).toBe("Hello");
  });

  it("requires adapter savePost for mapped-content post updates", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: vi.fn().mockResolvedValue({
        authorId: "author-1",
        categoryIds: [],
        contentFields: {},
        contentFormat: "html",
        contentHtml: "<p>Old</p>",
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
        title: "Old",
        updatedAt: "2026-03-27T00:30:00.000Z",
      }),
    });

    await expect(
      updateMappedContentPost({
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
        excerpt: "Excerpt",
        postId: "post-1",
        projectId: "project-1",
        title: "Hello",
      }),
    ).rejects.toThrow('Mapped content adapter is missing required method "savePost".');

    expect(updateMappedContentPostMock).not.toHaveBeenCalled();
  });
});
