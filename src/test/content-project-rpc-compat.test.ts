import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
const { introspectPostgresContentSchemaMock } = vi.hoisted(() => ({
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

import { createDefaultContentMappingConfig } from "@/lib/content-runtime/mapping";
import {
  getContentFilesStorageCredentialStatus,
  getContentS3CompatibleFilesCredentials,
} from "@/lib/content-runtime/server-project-credentials";
import {
  getContentProjectMappingDetection,
  getReadyContentProjectMapping,
  saveContentMappingRevision,
} from "@/lib/content-runtime/server-project-mapping";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createMappingRow = (mappingConfig = createDefaultContentMappingConfig()) => ({
  binding_id: "binding-1",
  binding_mode: "mapped_content",
  binding_status: "draft",
  canonical_schema_version: 1,
  install_config: { requested_setup_path: "mapped_content" },
  mapping_config: mappingConfig,
  revision_created_at: "2026-03-24T00:00:00.000Z",
  revision_id: "revision-1",
  revision_source: "system",
  revision_version: 1,
  scope_config: { schema: "public" },
  scope_mode: "database",
  storage_bucket: null,
});

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

describe("content project RPC compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    introspectPostgresContentSchemaMock.mockReset();
  });

  it("treats missing files storage env as an empty credential state without RPC fallback", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_project_cms_files_storage_credential_status(p_project_id) in the schema cache",
      },
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc,
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as never);

    await expect(getContentFilesStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("treats missing files storage env as no saved credentials without RPC fallback", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_project_cms_files_storage_credentials(p_project_id) in the schema cache",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as never);

    await expect(getContentS3CompatibleFilesCredentials("project-1")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("omits files storage save params when the mapping is not using files storage", async () => {
    const rpc = vi.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
      if (name === "save_project_content_mapping_revision") {
        return Promise.resolve({
          data: null,
          error: null,
        });
      }

      if (name === "get_project_content_mapping") {
        return Promise.resolve({
          data: createMappingRow(params.p_mapping_config as never),
          error: null,
        });
      }

      if (name === "get_project_content_runtime_mapping") {
        return Promise.resolve({
          data: createMappingRow(params.p_mapping_config as never),
          error: null,
        });
      }

      throw new Error(`Unexpected RPC call: ${name}`);
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc,
    } as never);

    const mapping = await saveContentMappingRevision({
      bindingStatus: "draft",
      dependencies: {
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
        getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
        withContentDatabaseClient: vi.fn(),
      },
      mappingConfig: createDefaultContentMappingConfig(),
      mappingScope: "full",
      projectId: "project-1",
      source: "system",
    });

    const saveCall = rpc.mock.calls.find(([name]) => name === "save_project_content_mapping_revision");
    const saveParams = saveCall?.[1] as Record<string, unknown>;

    expect(saveParams).toBeDefined();
    expect(saveParams).not.toHaveProperty("p_files_s3_access_key_id_auth_tag");
    expect(saveParams).not.toHaveProperty("p_files_s3_access_key_id_ciphertext");
    expect(saveParams).not.toHaveProperty("p_files_s3_secret_access_key_auth_tag");
    expect(saveParams).not.toHaveProperty("p_files_s3_secret_access_key_ciphertext");
    expect(saveParams).toMatchObject({
      p_binding_status: "draft",
      p_project_id: "project-1",
      p_source: "system",
    });
    expect(mapping.revisionId).toBe("revision-1");
  });

  it("does not include project-level S3 secret parameters when saving mappings", async () => {
    const mappingConfig = createDefaultContentMappingConfig();
    mappingConfig.mediaStorage = {
      bucketName: "media-assets",
      endpoint: "https://media.r2.cloudflarestorage.com",
      provider: "s3_compatible",
      publicUrlBase: null,
      region: "auto",
    };
    mappingConfig.filesStorage = {
      bucketName: "file-assets",
      endpoint: "https://files.r2.cloudflarestorage.com",
      provider: "s3_compatible",
      publicUrlBase: null,
      region: "auto",
    };

    const rpc = vi.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
      if (name === "save_project_content_mapping_revision") {
        return Promise.resolve({
          data: null,
          error: null,
        });
      }

      if (name === "get_project_content_mapping") {
        return Promise.resolve({
          data: createMappingRow(params.p_mapping_config as never),
          error: null,
        });
      }

      if (name === "get_project_content_runtime_mapping") {
        return Promise.resolve({
          data: createMappingRow(params.p_mapping_config as never),
          error: null,
        });
      }

      throw new Error(`Unexpected RPC call: ${name}`);
    });

    vi.mocked(createClient).mockResolvedValue({
      rpc,
    } as never);

    await saveContentMappingRevision({
      dependencies: {
        ensureProjectManagementPermission: vi.fn(),
        ensureProjectPermission: vi.fn(),
        getFilesStorageCredentialStatus: vi.fn().mockResolvedValue({
          hasS3AccessKeyId: true,
          hasS3SecretAccessKey: true,
        }),
        getMediaStorageCredentialStatus: vi.fn().mockResolvedValue({
          hasS3AccessKeyId: true,
          hasS3SecretAccessKey: true,
        }),
        getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
        withContentDatabaseClient: vi.fn(),
      },
      mappingConfig,
      mappingScope: "full",
      projectId: "project-1",
      source: "manual",
    });

    const saveCall = rpc.mock.calls.find(([name]) => name === "save_project_content_mapping_revision");
    const saveParams = saveCall?.[1] as Record<string, unknown>;

    expect(saveParams).toBeDefined();
    expect(Object.keys(saveParams).filter((key) => key.includes("_s3_"))).toEqual([]);
  });

  it("requires upload storage credentials before saving external storage", async () => {
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
        dependencies: {
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
          getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
          withContentDatabaseClient: vi.fn(),
        },
        mappingConfig,
        mappingScope: "media",
        projectId: "project-1",
        source: "manual",
      }),
    ).rejects.toThrow(
      "Add media upload storage credentials in the app configuration before saving this setup.",
    );
  });

  it("merges category saves into the stored mapping instead of replacing posts", async () => {
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

    const rpc = vi.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
      if (name === "get_project_content_runtime_mapping") {
        return Promise.resolve({
          data: createMappingRow(currentConfig),
          error: null,
        });
      }

      if (name === "save_project_content_mapping_revision") {
        return Promise.resolve({
          data: null,
          error: null,
        });
      }

      if (name === "get_project_content_mapping") {
        return Promise.resolve({
          data: createMappingRow(params.p_mapping_config as never),
          error: null,
        });
      }

      throw new Error(`Unexpected RPC call: ${name}`);
    });

    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);

    await saveContentMappingRevision({
      dependencies: {
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
        getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
        withContentDatabaseClient: vi.fn(),
      },
      mappingConfig: incomingConfig,
      mappingScope: "categories",
      projectId: "project-1",
      source: "manual",
    });

    const saveCall = rpc.mock.calls.find(([name]) => name === "save_project_content_mapping_revision");
    const saveParams = saveCall?.[1] as { p_mapping_config: ReturnType<typeof createDefaultContentMappingConfig> };

    expect(saveParams.p_mapping_config.entities.posts.source.table).toBe("posts");
    expect(saveParams.p_mapping_config.entities.categories.source.table).toBe("categories");
    expect(saveParams.p_mapping_config.entities.posts.relations.categories?.targetTable).toBe(
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

    const incomingConfig = createDefaultContentMappingConfig();
    incomingConfig.mediaStorage = {
      bucketName: "images",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    };

    const rpc = vi.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
      if (name === "get_project_content_runtime_mapping") {
        return Promise.resolve({
          data: createMappingRow(currentConfig),
          error: null,
        });
      }

      if (name === "save_project_content_mapping_revision") {
        return Promise.resolve({
          data: null,
          error: null,
        });
      }

      if (name === "get_project_content_mapping") {
        return Promise.resolve({
          data: createMappingRow(params.p_mapping_config as never),
          error: null,
        });
      }

      throw new Error(`Unexpected RPC call: ${name}`);
    });

    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);

    await saveContentMappingRevision({
      dependencies: {
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
        getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
        withContentDatabaseClient: vi.fn(),
      },
      mappingConfig: incomingConfig,
      mappingScope: "media",
      projectId: "project-1",
      source: "manual",
    });

    const saveCall = rpc.mock.calls.find(([name]) => name === "save_project_content_mapping_revision");
    const saveParams = saveCall?.[1] as { p_mapping_config: ReturnType<typeof createDefaultContentMappingConfig> };

    expect(saveParams.p_mapping_config.mediaStorage?.bucketName).toBe("images");
    expect(saveParams.p_mapping_config.filesStorage?.bucketName).toBe("docs");
  });

  it("keeps media storage untouched when saving files scope", async () => {
    const currentConfig = createDefaultContentMappingConfig();
    currentConfig.mediaStorage = {
      bucketName: "images",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    };

    const incomingConfig = createDefaultContentMappingConfig();
    incomingConfig.filesStorage = {
      bucketName: "docs",
      endpoint: null,
      provider: "supabase_bucket",
      publicUrlBase: null,
      region: null,
    };

    const rpc = vi.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
      if (name === "get_project_content_runtime_mapping") {
        return Promise.resolve({
          data: createMappingRow(currentConfig),
          error: null,
        });
      }

      if (name === "save_project_content_mapping_revision") {
        return Promise.resolve({
          data: null,
          error: null,
        });
      }

      if (name === "get_project_content_mapping") {
        return Promise.resolve({
          data: createMappingRow(params.p_mapping_config as never),
          error: null,
        });
      }

      throw new Error(`Unexpected RPC call: ${name}`);
    });

    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);

    await saveContentMappingRevision({
      dependencies: {
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
        getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
        withContentDatabaseClient: vi.fn(),
      },
      mappingConfig: incomingConfig,
      mappingScope: "files",
      projectId: "project-1",
      source: "manual",
    });

    const saveCall = rpc.mock.calls.find(([name]) => name === "save_project_content_mapping_revision");
    const saveParams = saveCall?.[1] as { p_mapping_config: ReturnType<typeof createDefaultContentMappingConfig> };

    expect(saveParams.p_mapping_config.filesStorage?.bucketName).toBe("docs");
    expect(saveParams.p_mapping_config.mediaStorage?.bucketName).toBe("images");
  });

  it("rejects duplicate column mappings before saving", async () => {
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

    const rpc = vi.fn();

    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);

    await expect(
      saveContentMappingRevision({
        dependencies: {
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
          getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
          withContentDatabaseClient: vi.fn(),
        },
        mappingConfig,
        mappingScope: "full",
        projectId: "project-1",
        source: "manual",
      }),
    ).rejects.toThrow(/mapped more than once/i);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("falls back to the authenticated mapping RPC when the runtime RPC is unavailable", async () => {
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
    const readyMappingRow = {
      ...createMappingRow(mappingConfig),
      binding_status: "ready",
    };

    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === "get_project_content_runtime_mapping") {
        return Promise.resolve({
          data: null,
          error: {
            code: "PGRST202",
            message:
              "Could not find the function public.get_project_content_runtime_mapping(p_project_id) in the schema cache",
          },
        });
      }

      if (name === "get_project_content_mapping") {
        return Promise.resolve({
          data: readyMappingRow,
          error: null,
        });
      }

      throw new Error(`Unexpected RPC call: ${name}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
    vi.mocked(createClient).mockResolvedValue({ rpc } as never);

    await expect(
      getReadyContentProjectMapping({
        context: {
          ...createProjectContext(),
          connectionString: null,
        },
        dependencies: {
          ensureProjectManagementPermission: vi.fn(),
          ensureProjectPermission: vi.fn(),
          getFilesStorageCredentialStatus: vi.fn(),
          getMediaStorageCredentialStatus: vi.fn(),
          getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
          withContentDatabaseClient: vi.fn(),
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
  });

  it("does not run full schema repair before returning a ready runtime mapping", async () => {
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
    const readyMappingRow = {
      ...createMappingRow(mappingConfig),
      binding_status: "ready",
    };
    const rpc = vi.fn().mockResolvedValue({
      data: readyMappingRow,
      error: null,
    });
    const withContentDatabaseClient = vi.fn();

    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);

    await expect(
      getReadyContentProjectMapping({
        context: {
          ...createProjectContext(),
          connectionString: "postgresql://content",
        },
        dependencies: {
          ensureProjectManagementPermission: vi.fn(),
          ensureProjectPermission: vi.fn(),
          getFilesStorageCredentialStatus: vi.fn(),
          getMediaStorageCredentialStatus: vi.fn(),
          getProjectContext: vi.fn().mockResolvedValue(createProjectContext()),
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
          ensureProjectManagementPermission: vi.fn(),
          ensureProjectPermission: vi.fn(),
          getFilesStorageCredentialStatus: vi.fn(),
          getMediaStorageCredentialStatus: vi.fn(),
          getProjectContext: vi.fn().mockResolvedValue({
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
          ensureProjectManagementPermission: vi.fn(),
          ensureProjectPermission: vi.fn(),
          getFilesStorageCredentialStatus: vi.fn(),
          getMediaStorageCredentialStatus: vi.fn(),
          getProjectContext: vi.fn().mockResolvedValue({
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
