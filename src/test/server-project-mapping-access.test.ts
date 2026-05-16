import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
}));

const { adminRpcMock, createAdminClientMock, createClientMock, rpcMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  adminRpcMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

describe("server project mapping access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createClientMock.mockResolvedValue({
      rpc: rpcMock,
    });
    createAdminClientMock.mockReturnValue({
      rpc: adminRpcMock,
    });
  });

  it("uses the runtime mapping RPC when server code does not need mapping-page permission", async () => {
    adminRpcMock.mockResolvedValue({
      data: [
        {
          binding_id: "binding-1",
          binding_mode: "mapped_content",
          binding_status: "ready",
          canonical_schema_version: 1,
          install_config: {},
          mapping_config: { version: 1 },
          revision_created_at: "2026-04-02T00:00:00.000Z",
          revision_id: "revision-1",
          revision_source: "manual",
          revision_version: 1,
          scope_config: {},
          scope_mode: "database",
          storage_bucket: null,
        },
      ],
      error: null,
    });

    const { loadStoredContentProjectMapping } = await import(
      "@/lib/content-runtime/server-content-mapping-state"
    );

    await loadStoredContentProjectMapping({
      context: {
        projectId: "project-1",
      },
      enforceReadPermission: false,
      projectId: "project-1",
    });

    expect(adminRpcMock).toHaveBeenCalledWith("get_project_content_runtime_mapping", {
      p_project_id: "project-1",
    });
  });

  it("falls back to a draft runtime mapping when the lightweight runtime RPC is unavailable", async () => {
    adminRpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_project_content_runtime_mapping(p_project_id) in the schema cache",
      },
    });
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_project_content_mapping(p_project_id) in the schema cache",
      },
    });

    const { loadStoredContentProjectMapping } = await import(
      "@/lib/content-runtime/server-content-mapping-state"
    );

    await expect(
      loadStoredContentProjectMapping({
        context: {
          projectId: "project-1",
        },
        enforceReadPermission: false,
        projectId: "project-1",
      }),
    ).resolves.toMatchObject({
      mapping: {
        bindingId: "project-1",
        bindingMode: "mapped_content",
        bindingStatus: "draft",
        revisionId: null,
      },
    });
  });

  it("uses the mapping-read RPC when the mapping page needs full mapping access checks", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          binding_id: "binding-1",
          binding_mode: "mapped_content",
          binding_status: "ready",
          canonical_schema_version: 1,
          install_config: {},
          mapping_config: { version: 1 },
          revision_created_at: "2026-04-02T00:00:00.000Z",
          revision_id: "revision-1",
          revision_source: "manual",
          revision_version: 1,
          scope_config: {},
          scope_mode: "database",
          storage_bucket: null,
        },
      ],
      error: null,
    });

    const { loadStoredContentProjectMapping } = await import(
      "@/lib/content-runtime/server-content-mapping-state"
    );

    await loadStoredContentProjectMapping({
      context: {
        projectId: "project-1",
      },
      enforceReadPermission: true,
      projectId: "project-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("get_project_content_mapping", {
      p_project_id: "project-1",
    });
  });
});
