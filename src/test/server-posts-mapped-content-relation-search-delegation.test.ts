import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethodMock,
  searchMappedContentAuthorsMock,
  searchMappedContentCategoriesMock,
  searchMappedContentParentPagesMock,
  searchMappedContentTagsMock,
} = vi.hoisted(() => ({
  createContentRuntimeAdapterMock: vi.fn(),
  getRequiredContentRuntimeAdapterMethodMock: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
  searchMappedContentAuthorsMock: vi.fn(),
  searchMappedContentCategoriesMock: vi.fn(),
  searchMappedContentParentPagesMock: vi.fn(),
  searchMappedContentTagsMock: vi.fn(),
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


vi.mock("@/lib/content-runtime/mapped-content-collections", () => ({
  loadMappedContentAuthors: vi.fn(),
  searchMappedContentAuthors: searchMappedContentAuthorsMock,
  searchMappedContentCategories: searchMappedContentCategoriesMock,
  searchMappedContentTags: searchMappedContentTagsMock,
}));

vi.mock("@/lib/content-runtime/mapped-content-post-support", () => ({
  getMappedRelationValuesForPosts: vi.fn(),
  loadMappedContentPostRows: vi.fn(),
  mapMappedContentPostListRow: vi.fn(),
  searchMappedContentParentPages: searchMappedContentParentPagesMock,
}));

vi.mock("@/lib/content-runtime/server-posts-list-cache", () => ({
  getCachedContentPostsCount: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-posts-query-cache", () => ({
  CONTENT_POSTS_QUERY_SNAPSHOT_MAX_ITEMS: 500,
  getCachedContentPostsQuerySnapshot: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-runtime-cache-keys", () => ({
  getContentAccessScopeCacheSignature: vi.fn(() => "scope"),
}));

vi.mock("@/lib/content-runtime/server-post-edit-sessions", () => ({
  getProjectPostAuthorAssignments: vi.fn(),
  getProjectPostEditSessions: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-content-post-projection", () => ({
  countContentPostsProjection: vi.fn(),
  getContentPostProjectionAuthorId: vi.fn(),
  getContentPostsProjectionPage: vi.fn(),
  getContentPostsProjectionState: vi.fn(),
  isMissingContentProjectionStorageError: vi.fn(() => false),
  listContentPostProjectionPreviews: vi.fn(),
}));

vi.mock("@/lib/content-runtime/server-content-post-projection-builder", () => ({
  refreshContentPostsProjection: vi.fn(),
}));

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import type {
  ContentProjectContext,
  ContentPostsDependencies,
} from "@/lib/content-runtime/server-posts-shared";
import {
  getMappedContentRelationOptions,
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
          categories: {
            fieldMap: {},
            junctionSourceColumn: "post_id",
            junctionTable: "post_categories",
            junctionTargetColumn: "category_id",
            multiple: true,
            sourceColumn: null,
            status: "mapped",
            strategy: "join_table",
            targetColumn: "id",
            targetEntity: "categories",
            targetTable: null,
            valueColumn: null,
          },
          tags: {
            fieldMap: {},
            junctionSourceColumn: "post_id",
            junctionTable: "post_tags",
            junctionTargetColumn: "tag_id",
            multiple: true,
            sourceColumn: null,
            status: "mapped",
            strategy: "join_table",
            targetColumn: "id",
            targetEntity: "tags",
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

const createDependencies = (mapping: ContentProjectMapping) =>
  ({
    ensureContentPermission: vi.fn(() => ["author-1"]),
    ensureDirectConnectionForMappedRuntime: vi.fn(),
    getBootstrapContentProjectMapping: vi.fn(),
    getPermissionError: vi.fn(() => "nope"),
    getProjectContext: vi.fn(),
    getReadyContentProjectMapping: vi.fn().mockResolvedValue(mapping),
    withContentDatabaseClient: vi.fn(async (_connectionString, handler) => handler({ query: vi.fn() })),
  }) as unknown as ContentPostsDependencies;

const context = {
  connectionString: "postgres://customer",
  memberAccess: {} as never,
  projectId: "project-1",
  projectSlug: "project-1",
  schemaOptions: {
    enableRevisions: true,
    enableRls: false,
    primaryContentFormat: "html" as const,
  },
  user: {
    id: "user-1",
  },
} as unknown as ContentProjectContext;

describe("server posts mapped-content relation search delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses adapter author relation search for mapped-content post relation options", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const searchAuthorsMock = vi.fn().mockResolvedValue([
      { id: "author-1", label: "Author One" },
    ]);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      searchAuthors: searchAuthorsMock,
    });

    const options = await getMappedContentRelationOptions({
      context,
      dependencies,
      fieldKey: "author",
      limit: 25,
      projectId: "project-1",
      search: "author",
      selectedIds: ["author-99"],
    });

    expect(searchAuthorsMock).toHaveBeenCalledWith({
      accessibleAuthorIds: ["author-1"],
      client: expect.objectContaining({ query: expect.any(Function) }),
      limit: 25,
      search: "author",
      selectedIds: ["author-99"],
    });
    expect(options).toEqual([{ id: "author-1", label: "Author One" }]);
  });

  it("requires adapter category relation search for mapped-content post relation options", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });
    await expect(
      getMappedContentRelationOptions({
        context,
        dependencies,
        fieldKey: "categories",
        limit: 10,
        projectId: "project-1",
        search: "news",
      }),
    ).rejects.toThrow('Mapped content adapter is missing required method "searchCategories".');

    expect(searchMappedContentCategoriesMock).not.toHaveBeenCalled();
  });

  it("requires adapter tag relation search for mapped-content post relation options", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });

    await expect(
      getMappedContentRelationOptions({
        context,
        dependencies,
        fieldKey: "tags",
        limit: 10,
        projectId: "project-1",
        search: "lau",
      }),
    ).rejects.toThrow('Mapped content adapter is missing required method "searchTags".');

    expect(searchMappedContentTagsMock).not.toHaveBeenCalled();
  });

  it("uses adapter parent-page relation search for mapped-content post relation options", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const searchParentPagesMock = vi.fn().mockResolvedValue([
      { id: "post-2", label: "Docs" },
    ]);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      searchParentPages: searchParentPagesMock,
    });

    const options = await getMappedContentRelationOptions({
      context,
      dependencies,
      fieldKey: "parentPage",
      limit: 25,
      projectId: "project-1",
      search: "docs",
    });

    expect(searchParentPagesMock).toHaveBeenCalledWith({
      accessibleAuthorIds: ["author-1"],
      client: expect.objectContaining({ query: expect.any(Function) }),
      limit: 25,
      search: "docs",
    });
    expect(options).toEqual([{ id: "post-2", label: "Docs" }]);
  });

  it("requires adapter parent-page relation search for mapped-content post relation options", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });

    await expect(
      getMappedContentRelationOptions({
        context,
        dependencies,
        fieldKey: "parentPage",
        limit: 10,
        projectId: "project-1",
        search: "doc",
      }),
    ).rejects.toThrow('Mapped content adapter is missing required method "searchParentPages".');

    expect(searchMappedContentParentPagesMock).not.toHaveBeenCalled();
  });

  it("routes custom author relation option reads through adapter author search", async () => {
    const mapping = createMappedContentMapping();
    mapping.mappingConfig.entities.posts.customRelationFields = [
      {
        enabled: true,
        fieldKey: "sponsor_author_id",
        isNullable: true,
        kind: "single_relation",
        label: "Sponsor Author",
        relation: {
          fieldMap: { name: "name" },
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "sponsor_author_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "id",
          targetEntity: "authors",
          targetTable: null,
          valueColumn: null,
        },
      },
    ];
    const dependencies = createDependencies(mapping);
    const searchAuthorsMock = vi.fn().mockResolvedValue([
      { id: "author-2", label: "Sponsor Author" },
    ]);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      searchAuthors: searchAuthorsMock,
    });

    const options = await getMappedContentRelationOptions({
      context,
      dependencies,
      fieldKey: "custom_field:sponsor_author_id",
      limit: 25,
      projectId: "project-1",
      search: "sponsor",
    });

    expect(searchAuthorsMock).toHaveBeenCalledWith({
      accessibleAuthorIds: ["author-1"],
      client: expect.objectContaining({ query: expect.any(Function) }),
      limit: 25,
      search: "sponsor",
    });
    expect(options).toEqual([{ id: "author-2", label: "Sponsor Author" }]);
  });

  it("routes custom media relation option reads through adapter media search", async () => {
    const mapping = createMappedContentMapping();
    mapping.mappingConfig.entities.posts.customRelationFields = [
      {
        enabled: true,
        fieldKey: "hero_media_id",
        isNullable: true,
        kind: "media_relation_single",
        label: "Hero Media",
        relation: {
          fieldMap: { title: "title" },
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "hero_media_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "id",
          targetEntity: "media",
          targetTable: null,
          valueColumn: null,
        },
      },
    ];
    const dependencies = createDependencies(mapping);
    const searchMediaMock = vi.fn().mockResolvedValue([{ id: "media-2", label: "cover.png" }]);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      searchMedia: searchMediaMock,
    });

    const options = await getMappedContentRelationOptions({
      context,
      dependencies,
      fieldKey: "custom_field:hero_media_id",
      limit: 25,
      projectId: "project-1",
      search: "cover",
    });

    expect(searchMediaMock).toHaveBeenCalledWith({
      client: expect.objectContaining({ query: expect.any(Function) }),
      limit: 25,
      search: "cover",
    });
    expect(options).toEqual([{ id: "media-2", label: "cover.png" }]);
  });

  it("routes custom file relation option reads through adapter file search", async () => {
    const mapping = createMappedContentMapping();
    mapping.mappingConfig.entities.posts.customRelationFields = [
      {
        enabled: true,
        fieldKey: "attachment_file_id",
        isNullable: true,
        kind: "file_relation_single",
        label: "Attachment File",
        relation: {
          fieldMap: { title: "title" },
          junctionSourceColumn: null,
          junctionTable: null,
          junctionTargetColumn: null,
          multiple: false,
          sourceColumn: "attachment_file_id",
          status: "mapped",
          strategy: "foreign_key",
          targetColumn: "id",
          targetEntity: "files",
          targetTable: null,
          valueColumn: null,
        },
      },
    ];
    const dependencies = createDependencies(mapping);
    const searchFilesMock = vi.fn().mockResolvedValue([{ id: "file-2", label: "spec.pdf" }]);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      searchFiles: searchFilesMock,
    });

    const options = await getMappedContentRelationOptions({
      context,
      dependencies,
      fieldKey: "custom_field:attachment_file_id",
      limit: 25,
      projectId: "project-1",
      search: "spec",
    });

    expect(searchFilesMock).toHaveBeenCalledWith({
      client: expect.objectContaining({ query: expect.any(Function) }),
      limit: 25,
      search: "spec",
    });
    expect(options).toEqual([{ id: "file-2", label: "spec.pdf" }]);
  });
});
