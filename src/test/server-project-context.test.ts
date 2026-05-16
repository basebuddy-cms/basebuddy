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
  cookiesMock,
  getAuthenticatedApiRequestContextMock,
  getContentProjectContextCredentialsMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  getAuthenticatedApiRequestContextMock: vi.fn(),
  getContentProjectContextCredentialsMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  APP_SETUP_REQUIRED_MESSAGE: "App setup required.",
  getAuthenticatedApiRequestContext: getAuthenticatedApiRequestContextMock,
  isControlPlaneSetupError: vi.fn(() => false),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/content-runtime/server-project-credentials", () => ({
  getContentProjectContextCredentials: getContentProjectContextCredentialsMock,
}));

describe("server project context", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    getAuthenticatedApiRequestContextMock.mockReset();
    getContentProjectContextCredentialsMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      getAll: () => [
        {
          name: "sb-project-auth-token",
          value: "session-token",
        },
      ],
    });
  });

  it("builds project runtime from install env without reading per-project connection records", async () => {
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "control-secret-key");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "content-secret-key");

    const maybeSingle = vi.fn(async () => ({
      data: {
        slug: "demo-project",
      },
      error: null,
    }));
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_current_project_member_access") {
        return {
          data: {
            author_scopes: [],
            permission_keys: ["content.read"],
            role_keys: ["owner"],
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
        rpc,
      },
      user: {
        id: "user-1",
      },
    });
    getContentProjectContextCredentialsMock.mockImplementation(() => {
      throw new Error("Project credentials should not be loaded in self-host runtime.");
    });

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      apiUrl: "https://install.supabase.co",
      connectionString: "postgresql://install-user:install-pass@db.local:5432/postgres",
      projectId: "project-1",
      projectSlug: "demo-project",
      publishableKey: "sb_publishable_install",
    });

    expect(rpc).toHaveBeenCalledWith("get_current_project_member_access", {
      p_project_id: "project-1",
    });
    expect(rpc).not.toHaveBeenCalledWith("get_project_cms_connection", expect.anything());
    expect(getContentProjectContextCredentialsMock).not.toHaveBeenCalled();
  });

  it("uses the split content-plane env for mapped runtime access while auth stays on the control plane", async () => {
    vi.stubEnv("BASEBUDDY_RUNTIME_TOPOLOGY", "split");
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "postgresql://control-user:install-pass@control.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://content-user:content-pass@content.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://control.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_control");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "control-secret-key");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_URL", "https://content.supabase.co");
    vi.stubEnv(
      "BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_content",
    );
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "content-secret-key");

    const maybeSingle = vi.fn(async () => ({
      data: {
        slug: "demo-project",
      },
      error: null,
    }));
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_current_project_member_access") {
        return {
          data: {
            author_scopes: [],
            permission_keys: ["content.read"],
            role_keys: ["owner"],
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
        rpc,
      },
      user: {
        id: "user-1",
      },
    });

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      apiUrl: "https://content.supabase.co",
      connectionString: "postgresql://content-user:content-pass@content.local:5432/postgres",
      publishableKey: "sb_publishable_content",
      projectId: "project-1",
      projectSlug: "demo-project",
    });
  });

  it("starts member access lookup without waiting on legacy connection state", async () => {
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "control-secret-key");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "content-secret-key");

    let resolveConnection:
      | ((value: {
          data: {
            access_method: "direct_connection";
            cms_installed_at: "2026-03-27T00:00:00.000Z";
            cms_schema_version: 2;
            cms_setup_path: "mapped_content";
            cms_storage_bucket: "bucket";
            cms_table_prefix: "demo-project";
          };
          error: null;
        }) => void)
      | null = null;

    const connectionPromise = new Promise<{
      data: {
        access_method: "direct_connection";
        cms_installed_at: "2026-03-27T00:00:00.000Z";
        cms_schema_version: 2;
        cms_setup_path: "mapped_content";
        cms_storage_bucket: "bucket";
        cms_table_prefix: "demo-project";
      };
      error: null;
    }>((resolve) => {
      resolveConnection = resolve;
    });

    const rpc = vi.fn((name: string) => {
      if (name === "get_project_cms_connection") {
        return connectionPromise;
      }

      if (name === "get_current_project_member_access") {
        return Promise.resolve({
          data: {
            author_scopes: [],
            permission_keys: ["content.read"],
            role_keys: ["owner"],
          },
          error: null,
        });
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  slug: "demo-project",
                },
                error: null,
              })),
            })),
          })),
        })),
        rpc,
      },
      user: {
        id: "user-1",
      },
    });

    getContentProjectContextCredentialsMock.mockResolvedValue({
      api_url: "https://demo.supabase.co",
      pooler_connection_string:
        "postgresql://demo-user:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      pooler_host: "aws-0-ap-south-1.pooler.supabase.com",
      pooler_user: "demo-user",
      publishable_key: "pk_test",
      secret_auth_tag: "tag",
      secret_ciphertext: "cipher",
      secret_iv: "iv",
      secret_key_version: 1,
    });

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");

    const pendingContext = getContentProjectContext("project-1");

    await vi.waitFor(() => {
      expect(
        rpc.mock.calls.some(([name]) => name === "get_current_project_member_access"),
      ).toBe(true);
    });
    expect(getContentProjectContextCredentialsMock).not.toHaveBeenCalled();

    resolveConnection?.({
      data: {
        access_method: "direct_connection",
        cms_installed_at: "2026-03-27T00:00:00.000Z",
        cms_schema_version: 2,
        cms_setup_path: "mapped_content",
        cms_storage_bucket: "bucket",
        cms_table_prefix: "demo-project",
      },
      error: null,
    });

    await expect(pendingContext).resolves.toMatchObject({
      projectId: "project-1",
      projectSlug: "demo-project",
    });
  });

  it("starts member access and project lookup early while deferring credential resolution until the access snapshot is ready", async () => {
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "control-secret-key");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "content-secret-key");

    let resolveAccess:
      | ((value: {
          data: {
            author_scopes: [];
            permission_keys: ["content.read"];
            role_keys: ["owner"];
          };
          error: null;
        }) => void)
      | null = null;
    let projectLookupStarted = false;

    const accessPromise = new Promise<{
      data: {
        author_scopes: [];
        permission_keys: ["content.read"];
        role_keys: ["owner"];
      };
      error: null;
    }>((resolve) => {
      resolveAccess = resolve;
    });

    const maybeSingle = vi.fn(async () => {
      projectLookupStarted = true;

      return {
        data: {
          slug: "demo-project",
        },
        error: null,
      };
    });

    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle,
        })),
      })),
    }));

    const rpc = vi.fn((name: string) => {
      if (name === "get_project_cms_connection") {
        return Promise.resolve({
          data: {
            access_method: "direct_connection",
            cms_installed_at: "2026-03-27T00:00:00.000Z",
            cms_schema_version: 2,
            cms_setup_path: "mapped_content",
            cms_storage_bucket: "bucket",
            cms_table_prefix: null,
          },
          error: null,
        });
      }

      if (name === "get_current_project_member_access") {
        return accessPromise;
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    const supabase = {
      from,
      rpc,
    };

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase,
      user: {
        id: "user-1",
      },
    });

    getContentProjectContextCredentialsMock.mockResolvedValue({
      api_url: "https://demo.supabase.co",
      pooler_connection_string: "postgresql://demo-user:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      pooler_host: "aws-0-ap-south-1.pooler.supabase.com",
      pooler_user: "demo-user",
      publishable_key: "pk_test",
      secret_auth_tag: "tag",
      secret_ciphertext: "cipher",
      secret_iv: "iv",
      secret_key_version: 1,
    });

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");

    const pendingContext = getContentProjectContext("project-1");

    await vi.waitFor(() => {
      expect(projectLookupStarted).toBe(true);
    });
    expect(getContentProjectContextCredentialsMock).not.toHaveBeenCalled();
    expect(getAuthenticatedApiRequestContextMock).toHaveBeenCalledWith({
      ensurePreparedProfile: false,
    });

    resolveAccess?.({
      data: {
        author_scopes: [],
        permission_keys: ["content.read"],
        role_keys: ["owner"],
      },
      error: null,
    });

    await expect(pendingContext).resolves.toMatchObject({
      projectId: "project-1",
      projectSlug: "demo-project",
    });
    expect(getContentProjectContextCredentialsMock).not.toHaveBeenCalled();
  });

  it("reuses the cold project context across repeated reads for the same authenticated session", async () => {
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "control-secret-key");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "content-secret-key");

    const maybeSingle = vi.fn(async () => ({
      data: {
        slug: "demo-project",
      },
      error: null,
    }));

    const rpc = vi.fn(async (name: string) => {
      if (name === "get_project_cms_connection") {
        return {
          data: {
            access_method: "direct_connection",
            cms_installed_at: "2026-03-27T00:00:00.000Z",
            cms_schema_version: 2,
            cms_setup_path: "mapped_content",
            cms_storage_bucket: "bucket",
            cms_table_prefix: null,
          },
          error: null,
        };
      }

      if (name === "get_current_project_member_access") {
        return {
          data: {
            author_scopes: [],
            permission_keys: ["content.read"],
            role_keys: ["owner"],
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      })),
      rpc,
    };

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase,
      user: {
        id: "user-1",
      },
    });

    getContentProjectContextCredentialsMock.mockResolvedValue({
      api_url: "https://demo.supabase.co",
      pooler_connection_string: "postgresql://demo-user:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      pooler_host: "aws-0-ap-south-1.pooler.supabase.com",
      pooler_user: "demo-user",
      publishable_key: "pk_test",
      secret_auth_tag: "tag",
      secret_ciphertext: "cipher",
      secret_iv: "iv",
      secret_key_version: 1,
    });

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      projectId: "project-1",
    });
    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      projectId: "project-1",
    });

    expect(getAuthenticatedApiRequestContextMock).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(getContentProjectContextCredentialsMock).not.toHaveBeenCalled();
  });

  it("reuses the cached project access snapshot when only the full context cache is invalidated", async () => {
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "control-secret-key");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "content-secret-key");

    const maybeSingle = vi.fn(async () => ({
      data: {
        slug: "demo-project",
      },
      error: null,
    }));

    const rpc = vi.fn(async (name: string) => {
      if (name === "get_project_cms_connection") {
        return {
          data: {
            access_method: "direct_connection",
            cms_installed_at: "2026-03-27T00:00:00.000Z",
            cms_schema_version: 2,
            cms_setup_path: "mapped_content",
            cms_storage_bucket: "bucket",
            cms_table_prefix: null,
          },
          error: null,
        };
      }

      if (name === "get_current_project_member_access") {
        return {
          data: {
            author_scopes: [],
            permission_keys: ["content.read"],
            role_keys: ["owner"],
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      })),
      rpc,
    };

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase,
      user: {
        id: "user-1",
      },
    });

    getContentProjectContextCredentialsMock.mockResolvedValue({
      api_url: "https://demo.supabase.co",
      pooler_connection_string: "postgresql://demo-user:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      pooler_host: "aws-0-ap-south-1.pooler.supabase.com",
      pooler_user: "demo-user",
      publishable_key: "pk_test",
      secret_auth_tag: "tag",
      secret_ciphertext: "cipher",
      secret_iv: "iv",
      secret_key_version: 1,
    });

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");
    const {
      invalidateProjectRuntimeCacheGroups,
      projectRuntimeCacheGroups,
    } = await import("@/lib/content-runtime/server-runtime-cache");

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      projectId: "project-1",
    });

    invalidateProjectRuntimeCacheGroups("project-1", [projectRuntimeCacheGroups.projectContext]);

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      projectId: "project-1",
    });

    expect(getAuthenticatedApiRequestContextMock).toHaveBeenCalledTimes(1);
    expect(
      rpc.mock.calls.filter(([name]) => name === "get_project_cms_connection"),
    ).toHaveLength(0);
    expect(
      rpc.mock.calls.filter(([name]) => name === "get_current_project_member_access"),
    ).toHaveLength(1);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(getContentProjectContextCredentialsMock).not.toHaveBeenCalled();
  });

  it("uses the install runtime env when no project-scoped datasource secret exists", async () => {
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://install-user:install-pass@db.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "control-secret-key");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");
    vi.stubEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "content-secret-key");

    const maybeSingle = vi.fn(async () => ({
      data: {
        slug: "demo-project",
      },
      error: null,
    }));

    const rpc = vi.fn((name: string) => {
      if (name === "get_project_cms_connection") {
        return {
          data: {
            access_method: "direct_connection",
            cms_installed_at: null,
            cms_schema_version: 1,
            cms_setup_path: "mapped_content",
            cms_storage_bucket: null,
            cms_table_prefix: null,
          },
          error: null,
        };
      }

      if (name === "get_current_project_member_access") {
        return {
          data: {
            author_scopes: [],
            permission_keys: ["content.read"],
            role_keys: ["owner"],
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
        rpc,
      },
      user: {
        id: "user-1",
      },
    });

    getContentProjectContextCredentialsMock.mockResolvedValue(null);

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      apiUrl: "https://install.supabase.co",
      connectionString: "postgresql://install-user:install-pass@db.local:5432/postgres",
      projectSlug: "demo-project",
      publishableKey: "sb_publishable_install",
    });
  });

  it("surfaces a clear runtime error when the content database url is missing for env-backed self-host access", async () => {
    vi.stubEnv("BASEBUDDY_CONTROL_DATABASE_URL", "");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_URL", "https://install.supabase.co");
    vi.stubEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_install");

    const maybeSingle = vi.fn(async () => ({
      data: {
        slug: "demo-project",
      },
      error: null,
    }));

    const rpc = vi.fn((name: string) => {
      if (name === "get_project_cms_connection") {
        return {
          data: {
            access_method: "direct_connection",
            cms_installed_at: null,
            cms_schema_version: 1,
            cms_setup_path: "mapped_content",
            cms_storage_bucket: null,
            cms_table_prefix: null,
          },
          error: null,
        };
      }

      if (name === "get_current_project_member_access") {
        return {
          data: {
            author_scopes: [],
            permission_keys: ["content.read"],
            role_keys: ["owner"],
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC ${name}`);
    });

    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
        rpc,
      },
      user: {
        id: "user-1",
      },
    });

    getContentProjectContextCredentialsMock.mockResolvedValue(null);

    const { getContentProjectContext } = await import("@/lib/content-runtime/server-project-context");

    await expect(getContentProjectContext("project-1")).rejects.toThrow(
      "Missing required environment variable: BASEBUDDY_CONTENT_DATABASE_URL",
    );
  });
});
