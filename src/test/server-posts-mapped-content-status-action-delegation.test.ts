import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  assertContentPostEditSessionMock,
  canAccessAuthorScopedContentMock,
  createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethodMock,
  refreshContentPostsProjectionMock,
  updateMappedContentPostMock,
} = vi.hoisted(() => ({
  assertContentPostEditSessionMock: vi.fn(),
  canAccessAuthorScopedContentMock: vi.fn((..._args: unknown[]) => true),
  createContentRuntimeAdapterMock: vi.fn(),
  getRequiredContentRuntimeAdapterMethodMock: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
  refreshContentPostsProjectionMock: vi.fn(),
  updateMappedContentPostMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/permissions", () => ({
  canAccessAuthorScopedContent: canAccessAuthorScopedContentMock,
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
  archiveMappedContentPost,
  publishMappedContentPost,
  unpublishMappedContentPost,
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

const existingPost = {
  authorId: "author-1",
  categoryIds: [],
  contentFields: {},
  contentFormat: "html" as const,
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
  status: "draft" as const,
  tagIds: [],
  title: "Old",
  updatedAt: "2026-03-27T00:30:00.000Z",
};

const updatedPost = {
  ...existingPost,
  title: "Hello",
};

const createBaseArguments = (mapping: ContentProjectMapping, client: { query: ReturnType<typeof vi.fn> }) => ({
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
  postId: "post-1",
  projectId: "project-1",
  title: "Hello",
});

describe("server posts mapped-content status action adapter delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canAccessAuthorScopedContentMock.mockReturnValue(true);
    refreshContentPostsProjectionMock.mockResolvedValue(undefined);
  });

  it("uses adapter publishPost for mapped-content publish actions", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const publishPostMock = vi.fn().mockResolvedValue({
      ...updatedPost,
      publishedAt: "2026-03-27T01:00:00.000Z",
      status: "published" as const,
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: vi.fn().mockResolvedValue(existingPost),
      publishPost: publishPostMock,
    });

    const post = await publishMappedContentPost(createBaseArguments(mapping, client));

    expect(publishPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
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
    expect(post.status).toBe("published");
  });

  it("uses adapter unpublishPost for mapped-content unpublish actions", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const unpublishPostMock = vi.fn().mockResolvedValue({
      ...updatedPost,
      publishedAt: null,
      status: "draft" as const,
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: vi.fn().mockResolvedValue(existingPost),
      unpublishPost: unpublishPostMock,
    });

    const post = await unpublishMappedContentPost(createBaseArguments(mapping, client));

    expect(unpublishPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        postId: "post-1",
        title: "Hello",
      }),
    );
    expect(updateMappedContentPostMock).not.toHaveBeenCalled();
    expect(post.status).toBe("draft");
  });

  it("uses adapter archivePost for mapped-content archive actions", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const archivePostMock = vi.fn().mockResolvedValue({
      ...updatedPost,
      publishedAt: null,
      status: "archived" as const,
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      archivePost: archivePostMock,
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: vi.fn().mockResolvedValue(existingPost),
    });

    const post = await archiveMappedContentPost(createBaseArguments(mapping, client));

    expect(archivePostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        postId: "post-1",
        title: "Hello",
      }),
    );
    expect(updateMappedContentPostMock).not.toHaveBeenCalled();
    expect(post.status).toBe("archived");
  });

  it("requires publish permission for unpublish and archive workflow actions", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const unpublishPostMock = vi.fn().mockResolvedValue({
      ...updatedPost,
      publishedAt: null,
      status: "draft" as const,
    });
    const archivePostMock = vi.fn().mockResolvedValue({
      ...updatedPost,
      publishedAt: null,
      status: "archived" as const,
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: vi.fn().mockResolvedValue({
        ...existingPost,
        status: "published" as const,
      }),
      unpublishPost: unpublishPostMock,
    });
    canAccessAuthorScopedContentMock.mockImplementation((_access, action) => action !== "publish");

    await expect(unpublishMappedContentPost(createBaseArguments(mapping, client))).rejects.toThrow("nope");
    expect(unpublishPostMock).not.toHaveBeenCalled();

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      archivePost: archivePostMock,
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: vi.fn().mockResolvedValue(existingPost),
    });

    await expect(archiveMappedContentPost(createBaseArguments(mapping, client))).rejects.toThrow("nope");
    expect(archivePostMock).not.toHaveBeenCalled();
  });

  it("requires publish permission for normal saves that change workflow status", async () => {
    const mapping = createMappedContentMapping();
    const client = { query: vi.fn() };
    const savePostMock = vi.fn().mockResolvedValue({
      ...updatedPost,
      status: "archived" as const,
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadPost: vi.fn().mockResolvedValue(existingPost),
      savePost: savePostMock,
    });
    canAccessAuthorScopedContentMock.mockImplementation((_access, action) => action !== "publish");

    await expect(
      updateMappedContentPost({
        ...createBaseArguments(mapping, client),
        status: "archived",
      }),
    ).rejects.toThrow("nope");
    expect(savePostMock).not.toHaveBeenCalled();
  });
});
