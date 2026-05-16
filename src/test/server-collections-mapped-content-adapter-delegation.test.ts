import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const {
  createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethodMock,
  createMappedContentCollectionEntryMock,
  deleteMappedContentCollectionEntriesMock,
  getMappedContentAuthorOptionsMock,
  getMappedContentAuthorsPageMock,
  getMappedContentCategoriesPageMock,
  getMappedContentTagsPageMock,
  updateMappedContentCollectionEntryMock,
} = vi.hoisted(() => ({
  createContentRuntimeAdapterMock: vi.fn(),
  getRequiredContentRuntimeAdapterMethodMock: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
  createMappedContentCollectionEntryMock: vi.fn(),
  deleteMappedContentCollectionEntriesMock: vi.fn(),
  getMappedContentAuthorOptionsMock: vi.fn(),
  getMappedContentAuthorsPageMock: vi.fn(),
  getMappedContentCategoriesPageMock: vi.fn(),
  getMappedContentTagsPageMock: vi.fn(),
  updateMappedContentCollectionEntryMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/adapter/factory", () => ({
  createContentRuntimeAdapter: createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethod: getRequiredContentRuntimeAdapterMethodMock,
}));


import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  getContentAuthorOptions,
  getContentAuthorsPage,
  getContentCategoriesPage,
  getContentTagsPage,
} from "@/lib/content-runtime/server-collections-pages";
import {
  createContentCollectionEntry,
  deleteContentCollectionEntries,
  updateContentCollectionEntry,
} from "@/lib/content-runtime/server-collections-mutations";

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

const createDependencies = (mapping: ContentProjectMapping) =>
  ({
    ensureAuthorManagementPermission: vi.fn(),
    ensureCollectionWritePermission: vi.fn(),
    ensureDirectConnectionForMappedRuntime: vi.fn(),
    getProjectContext: vi.fn(async () => ({
      connectionString: "postgresql://demo",
      memberAccess: {} as never,
      projectId: "project-1",
      projectSlug: "demo-project",
      schemaOptions: {
        enableRevisions: true,
        enableRls: true,
        primaryContentFormat: "html",
      },
      user: { id: "user-1" },
    })),
    getProjectPostAuthorAssignments: vi.fn(async () => new Map([["author-1", { avatar_url: null }]])),
    getReadyContentProjectMapping: vi.fn(async () => mapping),
    getUniqueSlugForTable: vi.fn(),
    withContentDatabaseClient: vi.fn(async (_connectionString: string, handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
      handler({
        query: vi.fn(),
      }),
    ),
  }) as never;

describe("server collections mapped-content adapter delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses adapter categories page loading for mapped-content category pages", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const loadCategoriesPageMock = vi.fn().mockResolvedValue({
      allCategories: [],
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadCategoriesPage: loadCategoriesPageMock,
    });

    const page = await getContentCategoriesPage({
      dependencies,
      includeAllCategories: true,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });

    expect(loadCategoriesPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAllCategories: true,
        page: 1,
        pageSize: 10,
        projectId: "project-1",
      }),
    );
    expect(getMappedContentCategoriesPageMock).not.toHaveBeenCalled();
    expect(page.items).toEqual([]);
  });

  it("requires adapter categories page loading for mapped-content category pages", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });

    await expect(
      getContentCategoriesPage({
        dependencies,
        includeAllCategories: true,
        page: 1,
        pageSize: 10,
        projectId: "project-1",
      }),
    ).rejects.toThrow('Mapped content adapter is missing required method "loadCategoriesPage".');

    expect(getMappedContentCategoriesPageMock).not.toHaveBeenCalled();
  });

  it("uses adapter tags page loading for mapped-content tag pages", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const loadTagsPageMock = vi.fn().mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadTagsPage: loadTagsPageMock,
    });

    const page = await getContentTagsPage({
      dependencies,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });

    expect(loadTagsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
      }),
    );
    expect(getMappedContentTagsPageMock).not.toHaveBeenCalled();
    expect(page.items).toEqual([]);
  });

  it("uses adapter authors page loading for mapped-content author pages", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const loadAuthorsPageMock = vi.fn().mockResolvedValue({
      items: [],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadAuthorsPage: loadAuthorsPageMock,
    });

    const page = await getContentAuthorsPage({
      dependencies,
      page: 1,
      pageSize: 10,
      projectId: "project-1",
    });

    expect(loadAuthorsPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorAssignmentsByAuthorId: expect.any(Map),
        page: 1,
        pageSize: 10,
      }),
    );
    expect(getMappedContentAuthorsPageMock).not.toHaveBeenCalled();
    expect(page.items).toEqual([]);
  });

  it("uses adapter author option loading for mapped-content author options", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const loadAuthorOptionsMock = vi.fn().mockResolvedValue([
      { id: "author-1", name: "Author One", slug: "author-one" },
    ]);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadAuthorOptions: loadAuthorOptionsMock,
    });

    const authors = await getContentAuthorOptions({
      dependencies,
      limit: 25,
      projectId: "project-1",
    });

    expect(loadAuthorOptionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 25,
      }),
    );
    expect(getMappedContentAuthorOptionsMock).not.toHaveBeenCalled();
    expect(authors).toEqual([
      { id: "author-1", name: "Author One", slug: "author-one" },
    ]);
  });

  it("uses adapter collection creation for mapped-content collection writes", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const createCollectionEntryMock = vi.fn().mockResolvedValue({
      id: "category-1",
      name: "News",
      slug: "news",
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      createCollectionEntry: createCollectionEntryMock,
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });

    const entry = await createContentCollectionEntry({
      collection: "categories",
      dependencies,
      description: "News posts",
      name: "News",
      projectId: "project-1",
    });

    expect(createCollectionEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "categories",
        description: "News posts",
        name: "News",
      }),
    );
    expect(createMappedContentCollectionEntryMock).not.toHaveBeenCalled();
    expect(entry).toEqual({
      id: "category-1",
      name: "News",
      slug: "news",
    });
  });

  it("requires adapter collection creation for mapped-content collection writes", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });

    await expect(
      createContentCollectionEntry({
        collection: "categories",
        dependencies,
        description: "News posts",
        name: "News",
        projectId: "project-1",
      }),
    ).rejects.toThrow('Mapped content adapter is missing required method "createCollectionEntry".');

    expect(createMappedContentCollectionEntryMock).not.toHaveBeenCalled();
  });

  it("uses adapter collection updates for mapped-content collection writes", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const updateCollectionEntryMock = vi.fn().mockResolvedValue({
      id: "tag-1",
      name: "Launch",
      slug: "launch",
    });

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      updateCollectionEntry: updateCollectionEntryMock,
    });

    const entry = await updateContentCollectionEntry({
      collection: "tags",
      dependencies,
      entryId: "tag-1",
      name: "Launch",
      projectId: "project-1",
      slug: "launch",
    });

    expect(updateCollectionEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "tags",
        entryId: "tag-1",
        name: "Launch",
        slug: "launch",
      }),
    );
    expect(updateMappedContentCollectionEntryMock).not.toHaveBeenCalled();
    expect(entry).toEqual({
      id: "tag-1",
      name: "Launch",
      slug: "launch",
    });
  });

  it("uses adapter collection deletes for mapped-content collection writes", async () => {
    const mapping = createMappedContentMapping();
    const dependencies = createDependencies(mapping);
    const deleteCollectionEntriesMock = vi.fn().mockResolvedValue(undefined);

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      deleteCollectionEntries: deleteCollectionEntriesMock,
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
    });

    await deleteContentCollectionEntries({
      collection: "authors",
      dependencies,
      entryIds: ["author-1", "author-2"],
      projectId: "project-1",
    });

    expect(deleteCollectionEntriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "authors",
        entryIds: ["author-1", "author-2"],
      }),
    );
    expect(deleteMappedContentCollectionEntriesMock).not.toHaveBeenCalled();
  });
});
