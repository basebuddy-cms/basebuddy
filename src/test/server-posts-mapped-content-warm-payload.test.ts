import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getMappedContentPostEditorPayloadMock,
  getProjectPostAuthorAssignmentsMock,
  getProjectPostEditSessionsMock,
} = vi.hoisted(() => ({
  getMappedContentPostEditorPayloadMock: vi.fn(),
  getProjectPostAuthorAssignmentsMock: vi.fn(),
  getProjectPostEditSessionsMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/permissions", () => ({
  canAccessAuthorScopedContent: vi.fn(() => true),
  getAccessibleAuthorIdsForAction: vi.fn(() => ["author-1"]),
  hasProjectContentPermission: vi.fn(() => true),
}));


vi.mock("@/lib/content-runtime/mapped-content-post-reads", () => ({
  getMappedContentPostAuthorId: vi.fn(),
  getMappedContentPostById: vi.fn(),
  getMappedContentPostEditorPayload: getMappedContentPostEditorPayloadMock,
  getMappedContentPostsPage: vi.fn(),
  getMappedContentSnapshot: vi.fn(),
  getMappedContentWorkspaceCounts: vi.fn(),
  hasReadyContentMapping: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-post-edit-sessions", () => ({
  getProjectPostAuthorAssignments: getProjectPostAuthorAssignmentsMock,
  getProjectPostEditSessions: getProjectPostEditSessionsMock,
}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import { getMappedContentPostEditorPayload } from "@/lib/content-runtime/server-posts-mapped-content";

const createMappedContentMapping = (revisionId: string): ContentProjectMapping =>
  ({
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
    revisionId,
    revisionVersion: 7,
  }) as ContentProjectMapping;

const createPayload = () => ({
  authors: [],
  categories: [],
  editorOptionsState: "warm",
  post: {
    authorId: "author-1",
    categoryIds: ["category-1"],
    contentFields: {},
    contentFormat: "html" as const,
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
    seoDescription: null,
    seoTitle: null,
    slug: "post-1",
    status: "draft" as const,
    tagIds: ["tag-1"],
    title: "Post 1",
    updatedAt: "2026-03-27T01:00:00.000Z",
  },
  tags: [],
});

const createFullPayload = () => ({
  ...createPayload(),
  authors: [
    {
      avatarUrl: null,
      bio: null,
      createdAt: "2026-03-27T00:00:00.000Z",
      email: null,
      id: "author-1",
      name: "Author One",
      slug: "author-one",
    },
  ],
  categories: [
    {
      id: "category-1",
      name: "Category One",
      slug: "category-one",
    },
  ],
  editorOptionsState: "full",
  tags: [
    {
      id: "tag-1",
      name: "Tag One",
      slug: "tag-one",
    },
  ],
});

describe("mapped content warm post payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectPostAuthorAssignmentsMock.mockResolvedValue(new Map());
    getProjectPostEditSessionsMock.mockResolvedValue(new Map());
  });

  it("uses the bootstrap mapping path for warm post payloads", async () => {
    const bootstrapMapping = createMappedContentMapping("bootstrap-revision");
    const client = {
      query: vi.fn(),
    };

    getMappedContentPostEditorPayloadMock.mockResolvedValue(createPayload());

    await expect(
      getMappedContentPostEditorPayload({
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
      }),
    ).resolves.toMatchObject({
      editorOptionsState: "warm",
      post: {
        id: "post-1",
      },
    });

    expect(getMappedContentPostEditorPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includeEditorOptions: false,
        mapping: bootstrapMapping,
        postId: "post-1",
        projectId: "project-1",
      }),
    );
  });

  it("falls back to the repaired mapping when the bootstrap mapping is stale", async () => {
    const bootstrapMapping = createMappedContentMapping("bootstrap-revision");
    const repairedMapping = createMappedContentMapping("repaired-revision");
    const client = {
      query: vi.fn(),
    };

    getMappedContentPostEditorPayloadMock
      .mockRejectedValueOnce(
        Object.assign(new Error('column "seo_title" does not exist'), {
          code: "42703",
        }),
      )
      .mockResolvedValueOnce(createPayload());

    const getReadyContentProjectMapping = vi.fn(async () => repairedMapping);

    await expect(
      getMappedContentPostEditorPayload({
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
          getReadyContentProjectMapping,
          withContentDatabaseClient: vi.fn(async (_connectionString, handler) => handler(client)),
        },
        includeEditorOptions: false,
        postId: "post-1",
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      post: {
        id: "post-1",
      },
    });

    expect(getMappedContentPostEditorPayloadMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mapping: bootstrapMapping,
      }),
    );
    expect(getMappedContentPostEditorPayloadMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mapping: repairedMapping,
      }),
    );
    expect(getReadyContentProjectMapping).toHaveBeenCalledWith({
      client,
      context: expect.objectContaining({
        projectId: "project-1",
      }),
      projectId: "project-1",
    });
  });

  it("uses the bootstrap mapping path for full post payloads before any repaired fallback", async () => {
    const bootstrapMapping = createMappedContentMapping("bootstrap-revision");
    const client = {
      query: vi.fn(),
    };

    getMappedContentPostEditorPayloadMock.mockResolvedValue(createFullPayload());

    await expect(
      getMappedContentPostEditorPayload({
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
            throw new Error("full payload should not require repaired mapping on a healthy bootstrap path");
          }),
          withContentDatabaseClient: vi.fn(async (_connectionString, handler) => handler(client)),
        },
        includeEditorOptions: true,
        postId: "post-1",
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      editorOptionsState: "full",
      post: {
        id: "post-1",
      },
    });

    expect(getMappedContentPostEditorPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includeEditorOptions: true,
        mapping: bootstrapMapping,
      }),
    );
  });
});
