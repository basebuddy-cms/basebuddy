import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const {
  createAdminClientMock,
  createClientMock,
  introspectPostgresContentSchemaMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  introspectPostgresContentSchemaMock: vi.fn(),
}));

vi.mock("@/lib/content-runtime/adapter/postgres/introspection", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/adapter/postgres/introspection")>(
    "@/lib/content-runtime/adapter/postgres/introspection",
  );

  return {
    ...actual,
    introspectPostgresContentSchema: introspectPostgresContentSchemaMock,
  };
});

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";
import {
  createDefaultContentMappingConfig,
  normalizeContentProjectMapping,
  type ContentMappingConfig,
} from "@/lib/content-runtime/mapping";
import {
  getContentProjectMappingDetection,
  getReadyContentProjectMapping,
  saveContentMappingRevision,
} from "@/lib/content-runtime/server-project-mapping";

const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

const createProjectContext = () => ({
  apiUrl: null,
  connectionString: null,
  memberAccess: {
    authorScopes: [],
    permissions: ["mapping.read", "mapping.write"],
    roles: ["owner"],
  },
  projectId: "project-1",
  projectSlug: "demo",
  publishableKey: null,
  schemaOptions: {
    enableRls: true,
    enableRevisions: true,
    primaryContentFormat: "html" as const,
  },
  user: {
    id: "user-1",
  } as never,
});

describe("project config mapping storage", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-content-project-mapping-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();
    introspectPostgresContentSchemaMock.mockReset();
    createClientMock.mockRejectedValue(new Error("Mapping persistence must not use Supabase."));
    createAdminClientMock.mockImplementation(() => {
      throw new Error("Mapping persistence must not use Supabase admin clients.");
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const writeProjectConfig = async ({
    bindingStatus = "draft",
    mappingConfig = createDefaultContentMappingConfig(),
  }: {
    bindingStatus?: "draft" | "ready";
    mappingConfig?: ContentMappingConfig;
  } = {}) => {
    const mapping = normalizeContentProjectMapping({
      bindingId: "project-1",
      bindingMode: "mapped_content",
      bindingStatus,
      mappingConfig,
      revisionId: "revision-1",
      revisionVersion: 1,
    });

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...createDefaultBaseBuddyConfig({
            now: fixedNow,
          }),
          projects: [
            {
              createdAt: fixedNow,
              createdBy: "user-1",
              id: "project-1",
              mapping,
              mappingRevisions: [
                {
                  bindingStatus,
                  createdAt: "2026-05-27T00:00:00.000Z",
                  id: "revision-1",
                  mappingConfig,
                  source: "system",
                  version: 1,
                },
              ],
              members: [],
              name: "Demo Project",
              sidebar: null,
              sidebarRevisions: [],
              slug: "demo-project",
              status: "active",
              updatedAt: fixedNow,
              websiteUrl: null,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
  };

  const readSavedProject = async () => {
    const config = JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as ReturnType<
      typeof createDefaultBaseBuddyConfig
    >;

    return config.projects[0]!;
  };

  const createDependencies = (context = createProjectContext()) => ({
    ensureProjectManagementPermission: vi.fn(),
    ensureProjectPermission: vi.fn(),
    getFilesStorageCredentialStatus: vi.fn().mockResolvedValue({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    }),
    getMediaStorageCredentialStatus: vi.fn().mockResolvedValue({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    }),
    getProjectContext: vi.fn().mockResolvedValue(context),
    withContentDatabaseClient: vi.fn(),
  });

  it("saves mapping revisions to config without control-plane RPCs", async () => {
    await writeProjectConfig();
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.entities.posts.status = "mapped";
    mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };

    const mapping = await saveContentMappingRevision({
      bindingStatus: "ready",
      dependencies: createDependencies(),
      mappingConfig,
      mappingScope: "full",
      projectId: "project-1",
      source: "manual",
    });
    const savedProject = await readSavedProject();

    expect(mapping).toMatchObject({
      bindingId: "project-1",
      bindingStatus: "ready",
      revisionVersion: 2,
    });
    expect(mapping.revisionId).not.toBe("revision-1");
    expect(normalizeContentProjectMapping(savedProject.mapping)).toEqual(mapping);
    expect(savedProject.mappingRevisions).toEqual([
      expect.objectContaining({
        id: "revision-1",
        source: "system",
        version: 1,
      }),
      {
        bindingStatus: "ready",
        createdAt: fixedNow,
        id: mapping.revisionId,
        mappingConfig: mapping.mappingConfig,
        source: "manual",
        version: 2,
      },
    ]);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("merges category saves into the stored config mapping instead of replacing posts", async () => {
    const currentConfig = createDefaultContentMappingConfig();
    currentConfig.entities.posts.status = "mapped";
    currentConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    currentConfig.entities.posts.fields.id.column = "id";
    currentConfig.entities.posts.fields.title.column = "title";
    await writeProjectConfig({
      mappingConfig: currentConfig,
    });

    const incomingConfig = createDefaultContentMappingConfig();
    incomingConfig.entities.categories.status = "mapped";
    incomingConfig.entities.categories.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "categories",
    };
    incomingConfig.entities.posts.relations.categories = {
      ...incomingConfig.entities.posts.relations.categories!,
      sourceColumn: "category_id",
      status: "mapped",
      strategy: "foreign_key",
      targetColumn: "id",
      targetTable: "public.categories",
    };

    const mapping = await saveContentMappingRevision({
      dependencies: createDependencies(),
      mappingConfig: incomingConfig,
      mappingScope: "categories",
      projectId: "project-1",
      source: "manual",
    });

    expect(mapping.mappingConfig.entities.posts.source.table).toBe("posts");
    expect(mapping.mappingConfig.entities.categories.source.table).toBe("categories");
    expect(mapping.mappingConfig.entities.posts.relations.categories?.targetTable).toBe(
      "public.categories",
    );
  });

  it("keeps files storage untouched when saving media scope", async () => {
    const currentConfig = createDefaultContentMappingConfig();
    currentConfig.filesStorage = {
      bucketName: "docs",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    };
    await writeProjectConfig({
      mappingConfig: currentConfig,
    });

    const incomingConfig = createDefaultContentMappingConfig();
    incomingConfig.mediaStorage = {
      bucketName: "images",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    };

    const mapping = await saveContentMappingRevision({
      dependencies: createDependencies(),
      mappingConfig: incomingConfig,
      mappingScope: "media",
      projectId: "project-1",
      source: "manual",
    });

    expect(mapping.mappingConfig.mediaStorage?.bucketName).toBe("images");
    expect(mapping.mappingConfig.filesStorage?.bucketName).toBe("docs");
  });

  it("requires media storage credentials before saving external storage", async () => {
    await writeProjectConfig();
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.mediaStorage = {
      bucketName: "media-assets",
      endpoint: "https://media.r2.cloudflarestorage.com",
      provider: "s3_compatible",
      publicUrlBase: null,
      region: "auto",
    };

    await expect(
      saveContentMappingRevision({
        dependencies: createDependencies(),
        mappingConfig,
        mappingScope: "media",
        projectId: "project-1",
        source: "manual",
      }),
    ).rejects.toThrow(
      "Add media storage keys in environment values before saving this mapping.",
    );

    expect((await readSavedProject()).mappingRevisions).toHaveLength(1);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects duplicate column mappings before saving", async () => {
    await writeProjectConfig();
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.entities.posts.status = "mapped";
    mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    mappingConfig.entities.posts.fields.id.column = "id";
    mappingConfig.entities.posts.fields.title.column = "title";
    mappingConfig.entities.posts.fields.slug.column = "title";

    await expect(
      saveContentMappingRevision({
        dependencies: createDependencies(),
        mappingConfig,
        mappingScope: "full",
        projectId: "project-1",
        source: "manual",
      }),
    ).rejects.toThrow(/mapped more than once/i);

    expect((await readSavedProject()).mappingRevisions).toHaveLength(1);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a ready runtime mapping from config without full schema repair", async () => {
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.entities.posts.status = "mapped";
    mappingConfig.entities.posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    mappingConfig.entities.posts.fields.id.column = "id";
    mappingConfig.entities.posts.fields.title.column = "title";
    await writeProjectConfig({
      bindingStatus: "ready",
      mappingConfig,
    });
    const withContentDatabaseClient = vi.fn();

    await expect(
      getReadyContentProjectMapping({
        context: {
          ...createProjectContext(),
          connectionString: "postgresql://content",
        },
        dependencies: {
          ...createDependencies(),
          withContentDatabaseClient,
        },
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      bindingStatus: "ready",
      mappingConfig: expect.objectContaining({
        entities: expect.objectContaining({
          posts: expect.objectContaining({
            source: expect.objectContaining({
              table: "posts",
            }),
          }),
        }),
      }),
    });
    expect(withContentDatabaseClient).not.toHaveBeenCalled();
    expect(introspectPostgresContentSchemaMock).not.toHaveBeenCalled();
  });

  it("scopes manual mapping detection to the selected table", async () => {
    introspectPostgresContentSchemaMock.mockResolvedValue({
      tables: [],
    });
    const withContentDatabaseClient = (async <T>(
      _connectionString: string,
      handler: (client: { query: typeof vi.fn }) => Promise<T>,
    ) => handler({ query: vi.fn() })) as never;

    await expect(
      getContentProjectMappingDetection({
        dependencies: {
          ...createDependencies({
            ...createProjectContext(),
            connectionString: "postgres://db",
          }),
          withContentDatabaseClient,
        },
        projectId: "project-1",
        tableRef: "public.posts",
      }),
    ).resolves.toMatchObject({
      suggestedMappingConfig: expect.any(Object),
      tables: [],
    });

    expect(introspectPostgresContentSchemaMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        focusTableRefs: ["public.posts"],
        includeSampleRows: "focused",
        maxSampleTables: 1,
        restrictToTableRefs: ["public.posts"],
      }),
    );
    void withContentDatabaseClient;
  });

  it("times out broad mapping detection with a manual fallback message", async () => {
    vi.useFakeTimers();

    try {
      introspectPostgresContentSchemaMock.mockImplementation(
        () =>
          new Promise(() => {
            // Intentionally never resolves.
          }),
      );

      const detectionPromise = getContentProjectMappingDetection({
        dependencies: {
          ...createDependencies({
            ...createProjectContext(),
            connectionString: "postgres://db",
          }),
          withContentDatabaseClient: (async <T>(
            _connectionString: string,
            handler: (client: { query: typeof vi.fn }) => Promise<T>,
          ) => handler({ query: vi.fn() })) as never,
        },
        projectId: "project-1",
      });
      const rejectionAssertion = detectionPromise.then(
        () => {
          throw new Error("Expected mapping detection to time out.");
        },
        (error) => {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/choose a table manually to continue/i);
        },
      );

      await vi.runAllTimersAsync();
      await rejectionAssertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
