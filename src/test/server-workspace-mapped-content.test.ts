import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => {
    const memoized = new Map<string, Promise<unknown>>();

    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);

      if (!memoized.has(key)) {
        memoized.set(key, fn(...args));
      }

      return memoized.get(key) as ReturnType<T>;
    }) as unknown as T;
  },
}));

const {
  createContentRuntimeAdapterMock,
  getRequiredContentRuntimeAdapterMethodMock,
  countContentPostsProjectionMock,
  getContentPostsProjectionStateMock,
  getMappedContentRuntimeMock,
  getMappedContentWorkspaceCountsMock,
  getPersistedContentWorkspaceSummaryMock,
  listS3CompatibleMediaObjectsMock,
  queueContentWorkspaceSummaryBackgroundRefreshMock,
  savePersistedContentWorkspaceSummaryMock,
} = vi.hoisted(() => ({
  createContentRuntimeAdapterMock: vi.fn(),
  getRequiredContentRuntimeAdapterMethodMock: vi.fn((adapter: Record<string, unknown>, methodName: string) => {
    const method = adapter[methodName];

    if (typeof method !== "function") {
      throw new Error(`Mapped content adapter is missing required method "${methodName}".`);
    }

    return method;
  }),
  countContentPostsProjectionMock: vi.fn(),
  getContentPostsProjectionStateMock: vi.fn(),
  getMappedContentRuntimeMock: vi.fn(),
  getMappedContentWorkspaceCountsMock: vi.fn(),
  getPersistedContentWorkspaceSummaryMock: vi.fn(),
  listS3CompatibleMediaObjectsMock: vi.fn(),
  queueContentWorkspaceSummaryBackgroundRefreshMock: vi.fn(),
  savePersistedContentWorkspaceSummaryMock: vi.fn(),
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

vi.mock("@/lib/content-runtime/server-content-post-projection", () => ({
  countContentPostsProjection: countContentPostsProjectionMock,
  getContentPostsProjectionState: getContentPostsProjectionStateMock,
  isMissingContentProjectionStorageError: vi.fn(() => false),
}));

vi.mock("@/lib/content-runtime/s3-compatible-storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/s3-compatible-storage")>(
    "@/lib/content-runtime/s3-compatible-storage",
  );

  return {
    ...actual,
    listS3CompatibleMediaObjects: listS3CompatibleMediaObjectsMock,
  };
});

vi.mock("@/lib/content-runtime/server-posts-mapped-content", () => ({
  getCachedContentPostsPreviewSnapshot: vi.fn(),
  shouldUseContentAuthorFallbackPreviewSnapshot: vi.fn(() => false),
}));

vi.mock("@/lib/content-runtime/server-runtime-cache-keys", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/server-runtime-cache-keys")>(
    "@/lib/content-runtime/server-runtime-cache-keys",
  );

  return {
    ...actual,
    getContentAccessScopeCacheSignature: vi.fn(() => "scope"),
  };
});

vi.mock("@/lib/content-runtime/server-runtime-summary", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/server-runtime-summary")>(
    "@/lib/content-runtime/server-runtime-summary",
  );

  return {
    ...actual,
    getPersistedContentWorkspaceSummary: getPersistedContentWorkspaceSummaryMock,
    queueContentWorkspaceSummaryBackgroundRefresh:
      queueContentWorkspaceSummaryBackgroundRefreshMock,
    savePersistedContentWorkspaceSummary: savePersistedContentWorkspaceSummaryMock,
  };
});

import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  createDefaultContentPostSidebarConfig,
  getContentVisibleCollectionsFromRuntimeSummary,
} from "@/lib/content-runtime/shared";
import {
  getContentWorkspaceMetaForMappedContent,
  getContentWorkspaceSummaryForMappedContent,
} from "@/lib/content-runtime/server-workspace-mapped-content";

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
    mediaStorage: {
      bucketName: "cms-media",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    },
    version: 1,
  },
  revisionId: "revision-1",
  revisionVersion: 7,
});

const createMappedContentMappingWithS3Storage = (): ContentProjectMapping => {
  const mapping = createMappedContentMapping();

  mapping.mappingConfig.mediaStorage = {
    bucketName: "cms-media",
    endpoint: "https://s3.example.com",
    provider: "s3_compatible",
    publicUrlBase: null,
    region: "us-east-1",
  };
  mapping.mappingConfig.filesStorage = {
    bucketName: "cms-files",
    endpoint: "https://s3.example.com",
    provider: "s3_compatible",
    publicUrlBase: null,
    region: "us-east-1",
  };

  return mapping;
};

const createMappedContentMappingWithoutManagedStorage = (): ContentProjectMapping => {
  const mapping = createMappedContentMapping();

  mapping.mappingConfig.mediaStorage = null;
  mapping.mappingConfig.filesStorage = null;

  return mapping;
};

describe("server workspace mapped-content resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(() => ({
        customFields: [],
        editorFields: [],
        fieldSpecs: [],
        filesStorage: null,
        mediaStorage: {
          bucketName: "cms-media",
          canManage: false,
          provider: "supabase_bucket",
          supportsLibrary: true,
        },
        sidebarFieldSpecs: [],
      })),
      kind: "postgres_content",
      loadWorkspaceCounts: vi.fn(async () => ({
        authors: 1,
        categories: 2,
        files: 0,
        media: 0,
        posts: 3,
        tags: 4,
      })),
      loadWorkspace: vi.fn(async () => ({
        customFields: [],
        editorFields: [],
        fieldSpecs: [],
        filesStorage: null,
        mediaStorage: {
          bucketName: "cms-media",
          canManage: false,
          provider: "supabase_bucket",
          supportsLibrary: true,
        },
        sidebarFieldSpecs: [],
      })),
    });
    getMappedContentRuntimeMock.mockReturnValue({
      authors: { source: { primaryKey: "id" } },
      categories: { source: { primaryKey: "id" } },
      media: { source: { primaryKey: "id" } },
      posts: { relations: { authors: {}, categories: {}, tags: {} }, source: { primaryKey: "id" } },
      tags: { source: { primaryKey: "id" } },
    });
    getMappedContentWorkspaceCountsMock.mockResolvedValue({
      authors: 1,
      categories: 2,
      files: 0,
      media: 0,
      posts: 3,
      tags: 4,
    });
    getContentPostsProjectionStateMock.mockResolvedValue(null);
    countContentPostsProjectionMock.mockResolvedValue(3);
    listS3CompatibleMediaObjectsMock.mockResolvedValue([]);
    getPersistedContentWorkspaceSummaryMock.mockResolvedValue(null);
    queueContentWorkspaceSummaryBackgroundRefreshMock.mockResolvedValue(undefined);
    savePersistedContentWorkspaceSummaryMock.mockResolvedValue(undefined);
  });

  it("does not fail the workspace summary when storage credential reads throw", async () => {
    const mapping = createMappedContentMapping();

    await expect(
      getContentWorkspaceSummaryForMappedContent({
        context: {
          apiUrl: null,
          connectionString: "postgresql://demo",
          memberAccess: {
            permissions: [],
            roles: ["owner"],
          } as never,
          projectSlug: "existing-one",
          schemaOptions: {
            enableRevisions: true,
            primaryContentFormat: "html",
          },
        },
        dependencies: {
          ensureContentPermission: vi.fn(() => null),
          ensureDirectConnectionForMappedRuntime: vi.fn(),
          getBootstrapContentProjectMapping: vi.fn(async () => mapping),
          getProjectContext: vi.fn(),
          getContentS3CompatibleFilesCredentials: vi.fn(async () => null),
          getContentS3CompatibleMediaCredentials: vi.fn(async () => null),
          getContentStorageServiceKey: vi.fn(async () => {
            throw new Error("Could not load storage key.");
          }),
          getProjectPostSidebarConfig: vi.fn(async () => createDefaultContentPostSidebarConfig()),
          getProjectPostAuthorAssignments: vi.fn(async () => new Map()),
          getReadyContentProjectMapping: vi.fn(async () => mapping),
          withContentDatabaseClient: (async <T>(
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<T>,
          ) =>
            handler({
              query: vi.fn(),
            })) as never,
        },
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      counts: {
        authors: 1,
        categories: 2,
        files: 0,
        media: 0,
        posts: 3,
        tags: 4,
      },
    });
  });

  it("uses the lightweight bootstrap mapping path for workspace meta", async () => {
    const mapping = createMappedContentMapping();

    await expect(
      getContentWorkspaceMetaForMappedContent({
        context: {
          apiUrl: null,
          connectionString: "postgresql://demo",
          memberAccess: {
            permissions: ["content.read"],
            roles: ["owner"],
          } as never,
          projectSlug: "existing-one",
          schemaOptions: {
            enableRevisions: true,
            primaryContentFormat: "html",
          },
        },
        dependencies: {
          ensureContentPermission: vi.fn(() => null),
          ensureDirectConnectionForMappedRuntime: vi.fn(),
          getBootstrapContentProjectMapping: vi.fn(async () => mapping),
          getProjectContext: vi.fn(),
          getContentS3CompatibleFilesCredentials: vi.fn(async () => null),
          getContentS3CompatibleMediaCredentials: vi.fn(async () => null),
          getContentStorageServiceKey: vi.fn(async () => null),
          getProjectPostSidebarConfig: vi.fn(async () => createDefaultContentPostSidebarConfig()),
          getProjectPostAuthorAssignments: vi.fn(async () => new Map()),
          getReadyContentProjectMapping: vi.fn(async () => {
            throw new Error("workspace meta should not require repaired mapping");
          }),
          withContentDatabaseClient: vi.fn(),
        } as never,
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      workspaceState: "ready",
    });
  });

  it("defers author-scoped post counts when projection counts are unavailable", async () => {
    const mapping = createMappedContentMapping();
    const loadWorkspaceCountsMock = vi.fn(async () => ({
      authors: 1,
      categories: 2,
      files: 0,
      media: 0,
      posts: 500000,
      tags: 4,
    }));

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadWorkspaceCounts: loadWorkspaceCountsMock,
    });
    getContentPostsProjectionStateMock.mockResolvedValue(null);

    await expect(
      getContentWorkspaceSummaryForMappedContent({
        context: {
          apiUrl: null,
          connectionString: "postgresql://demo",
          memberAccess: {
            permissions: ["content.read"],
            roles: ["author"],
          } as never,
          projectSlug: "existing-one",
          schemaOptions: {
            enableRevisions: true,
            primaryContentFormat: "html",
          },
        },
        dependencies: {
          ensureContentPermission: vi.fn(() => ["author-1"]),
          ensureDirectConnectionForMappedRuntime: vi.fn(),
          getBootstrapContentProjectMapping: vi.fn(async () => mapping),
          getProjectContext: vi.fn(),
          getContentS3CompatibleFilesCredentials: vi.fn(async () => null),
          getContentS3CompatibleMediaCredentials: vi.fn(async () => null),
          getContentStorageServiceKey: vi.fn(async () => null),
          getProjectPostSidebarConfig: vi.fn(async () => createDefaultContentPostSidebarConfig()),
          getProjectPostAuthorAssignments: vi.fn(async () => new Map()),
          getReadyContentProjectMapping: vi.fn(async () => mapping),
          withContentDatabaseClient: (async <T>(
            _connectionString: string,
            handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<T>,
          ) =>
            handler({
              query: vi.fn(),
            })) as never,
        },
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      counts: {
        posts: 0,
      },
      isDerived: true,
      pendingCollections: expect.arrayContaining(["posts"]),
    });

    expect(loadWorkspaceCountsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleAuthorIds: ["author-1"],
      }),
    );
    expect(countContentPostsProjectionMock).not.toHaveBeenCalled();
  });

  it("does not scan S3-compatible buckets when refreshing workspace storage counts", async () => {
    const mapping = createMappedContentMappingWithS3Storage();

    await getContentWorkspaceSummaryForMappedContent({
      context: {
        apiUrl: null,
        connectionString: "postgresql://demo",
        memberAccess: {
          permissions: ["content.read"],
          roles: ["owner"],
        } as never,
        projectSlug: "existing-one",
        schemaOptions: {
          enableRevisions: true,
          primaryContentFormat: "html",
        },
      },
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        ensureDirectConnectionForMappedRuntime: vi.fn(),
        getBootstrapContentProjectMapping: vi.fn(async () => mapping),
        getProjectContext: vi.fn(),
        getContentS3CompatibleFilesCredentials: vi.fn(async () => ({
          accessKeyId: "files-access-key",
          secretAccessKey: "files-secret-key",
        })),
        getContentS3CompatibleMediaCredentials: vi.fn(async () => ({
          accessKeyId: "media-access-key",
          secretAccessKey: "media-secret-key",
        })),
        getContentStorageServiceKey: vi.fn(async () => null),
        getProjectPostSidebarConfig: vi.fn(async () => createDefaultContentPostSidebarConfig()),
        getProjectPostAuthorAssignments: vi.fn(async () => new Map()),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: (async <T>(
          _connectionString: string,
          handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<T>,
        ) =>
          handler({
            query: vi.fn(),
          })) as never,
      },
      projectId: "project-1",
    });

    const refresh = queueContentWorkspaceSummaryBackgroundRefreshMock.mock.calls[0]?.[0]?.refresh;

    expect(refresh).toEqual(expect.any(Function));

    await refresh();

    expect(listS3CompatibleMediaObjectsMock).not.toHaveBeenCalled();
  });

  it("uses approximate mapped table counts for workspace summary bootstrap", async () => {
    const mapping = createMappedContentMappingWithoutManagedStorage();
    const loadWorkspaceCountsMock = vi.fn(async () => ({
      authors: 500_000,
      categories: 500_000,
      files: 0,
      media: 0,
      posts: 500_000,
      tags: 500_000,
    }));

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadWorkspaceCounts: loadWorkspaceCountsMock,
    });

    const summary = await getContentWorkspaceSummaryForMappedContent({
      context: {
        apiUrl: null,
        connectionString: "postgresql://demo",
        memberAccess: {
          permissions: ["content.read"],
          roles: ["owner"],
        } as never,
        projectSlug: "existing-one",
        schemaOptions: {
          enableRevisions: true,
          primaryContentFormat: "html",
        },
      },
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        ensureDirectConnectionForMappedRuntime: vi.fn(),
        getBootstrapContentProjectMapping: vi.fn(async () => mapping),
        getProjectContext: vi.fn(),
        getContentS3CompatibleFilesCredentials: vi.fn(async () => null),
        getContentS3CompatibleMediaCredentials: vi.fn(async () => null),
        getContentStorageServiceKey: vi.fn(async () => null),
        getProjectPostSidebarConfig: vi.fn(async () => createDefaultContentPostSidebarConfig()),
        getProjectPostAuthorAssignments: vi.fn(async () => new Map()),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: (async <T>(
          _connectionString: string,
          handler: (client: { query: ReturnType<typeof vi.fn> }) => Promise<T>,
        ) =>
          handler({
            query: vi.fn(),
          })) as never,
      },
      projectId: "project-1",
    });

    expect(loadWorkspaceCountsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        approximateCounts: true,
      }),
    );
    expect(summary).toMatchObject({
      counts: {
        posts: 500_000,
      },
      isExact: false,
    });
  });

  it("loads mapped-content runtime workspace summary through the adapter for workspace meta", async () => {
    const mapping = createMappedContentMapping();
    const loadWorkspaceMock = vi.fn(async () => ({
      customFields: [],
      editorFields: [],
      fieldSpecs: [
        {
          allowedValues: null,
          contentFormat: null,
          editabilityState: "editable",
          fieldKey: "author",
          label: "Author",
          multiple: false,
          nullable: true,
          patchMode: "replace",
          readOnly: false,
          relationMode: "managed_single",
          required: false,
          searchMode: "remote",
          semanticRole: "author",
          uiControl: "single_select",
          valueKind: "relation_id_or_key",
          visible: true,
        },
      ],
      filesStorage: null,
      mediaStorage: null,
      sidebarFieldSpecs: [],
    }));

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: vi.fn(),
      kind: "postgres_content",
      loadWorkspace: loadWorkspaceMock,
    });

    const result = await getContentWorkspaceMetaForMappedContent({
      context: {
        apiUrl: null,
        connectionString: "postgresql://demo",
        memberAccess: {
          permissions: ["content.read"],
          roles: ["owner"],
        } as never,
        projectSlug: "existing-one",
        schemaOptions: {
          enableRevisions: true,
          primaryContentFormat: "html",
        },
      },
      dependencies: {
        ensureContentPermission: vi.fn(() => null),
        ensureDirectConnectionForMappedRuntime: vi.fn(),
        getBootstrapContentProjectMapping: vi.fn(async () => mapping),
        getProjectContext: vi.fn(),
        getContentS3CompatibleFilesCredentials: vi.fn(async () => null),
        getContentS3CompatibleMediaCredentials: vi.fn(async () => null),
        getContentStorageServiceKey: vi.fn(async () => null),
        getProjectPostSidebarConfig: vi.fn(async () => createDefaultContentPostSidebarConfig()),
        getProjectPostAuthorAssignments: vi.fn(async () => new Map()),
        getReadyContentProjectMapping: vi.fn(async () => mapping),
        withContentDatabaseClient: vi.fn(),
      } as never,
      projectId: "project-1",
    });

    expect(createContentRuntimeAdapterMock).toHaveBeenCalled();
    expect(loadWorkspaceMock).toHaveBeenCalledWith();
    expect(getContentVisibleCollectionsFromRuntimeSummary({ runtime: result.contentRuntime }).authors).toBe(
      true,
    );
  });

  it("requires the adapter workspace loader for mapped-content boot payloads", async () => {
    const mapping = createMappedContentMapping();
    const getCapabilitySummaryMock = vi.fn(() => ({
      customFields: [],
      editorFields: [],
      fieldSpecs: [],
      filesStorage: null,
      mediaStorage: null,
      sidebarFieldSpecs: [],
    }));

    createContentRuntimeAdapterMock.mockReturnValue({
      compiled: {},
      getCapabilitySummary: getCapabilitySummaryMock,
      kind: "postgres_content",
    });

    await expect(
      getContentWorkspaceMetaForMappedContent({
        context: {
          apiUrl: null,
          connectionString: "postgresql://demo",
          memberAccess: {
            permissions: ["content.read"],
            roles: ["owner"],
          } as never,
          projectSlug: "existing-one",
          schemaOptions: {
            enableRevisions: true,
            primaryContentFormat: "html",
          },
        },
        dependencies: {
          ensureContentPermission: vi.fn(() => null),
          ensureDirectConnectionForMappedRuntime: vi.fn(),
          getBootstrapContentProjectMapping: vi.fn(async () => mapping),
          getProjectContext: vi.fn(),
          getContentS3CompatibleFilesCredentials: vi.fn(async () => null),
          getContentS3CompatibleMediaCredentials: vi.fn(async () => null),
          getContentStorageServiceKey: vi.fn(async () => null),
          getProjectPostSidebarConfig: vi.fn(async () => createDefaultContentPostSidebarConfig()),
          getProjectPostAuthorAssignments: vi.fn(async () => new Map()),
          getReadyContentProjectMapping: vi.fn(async () => mapping),
          withContentDatabaseClient: vi.fn(),
        } as never,
        projectId: "project-1",
      }),
    ).rejects.toThrow("This project setup needs attention before the workspace can load.");
    expect(getCapabilitySummaryMock).not.toHaveBeenCalled();
  });
});
