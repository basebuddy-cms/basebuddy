import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const {
  getAuthenticatedApiRequestContextMock,
} = vi.hoisted(() => ({
  getAuthenticatedApiRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getAuthenticatedApiRequestContext: getAuthenticatedApiRequestContextMock,
}));

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";

const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

const createConfig = ({
  provider = "postgres",
}: {
  provider?: "postgres";
} = {}) => ({
  ...createDefaultBaseBuddyConfig({
    content: {
      provider,
    },
    now: fixedNow,
  }),
  projects: [
    {
      createdAt: fixedNow,
      createdBy: "user-1",
      id: "project-1",
      mapping: null,
      mappingRevisions: [],
      members: [
        {
          allowPermissionKeys: [],
          authorScopes: [],
          denyPermissionKeys: [],
          joinedAt: fixedNow,
          roles: ["owner"],
          userId: "user-1",
        },
      ],
      name: "Demo Project",
      sidebar: null,
      sidebarRevisions: [],
      slug: "demo-project",
      status: "active",
      updatedAt: fixedNow,
      websiteUrl: null,
    },
  ],
  users: [
    {
      avatarUrl: null,
      createdAt: fixedNow,
      email: "demo@example.com",
      id: "user-1",
      name: "Demo User",
      passwordHash: "hash",
      passwordHashParams: {
        keyLength: 64,
        name: "scrypt",
      },
      passwordSalt: "salt",
      updatedAt: fixedNow,
    },
  ],
});

describe("server project context", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-project-context-"));
    process.chdir(tempDir);
    vi.resetModules();
    vi.unstubAllEnvs();
    getAuthenticatedApiRequestContextMock.mockReset();
    getAuthenticatedApiRequestContextMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "demo@example.com",
        name: "Demo User",
      },
      ok: true,
      user: {
        id: "user-1",
      },
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const writeConfig = async (
    input: Parameters<typeof createConfig>[0] = {},
  ) => {
    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(createConfig(input), null, 2),
      "utf8",
    );
  };

  it("builds project runtime from env credentials and config project state", async () => {
    await writeConfig();
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://env:env-pass@content.local:5432/postgres");
    vi.stubEnv("BASEBUDDY_SUPABASE_URL", "https://env-storage.supabase.co");
    vi.stubEnv("BASEBUDDY_SUPABASE_PUBLISHABLE_KEY", "env-publishable-key");

    const { getContentProjectContext } = await import(
      "@/lib/content-runtime/server-project-context"
    );

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      apiUrl: "https://env-storage.supabase.co",
      connectionString: "postgresql://env:env-pass@content.local:5432/postgres",
      projectId: "project-1",
      projectSlug: "demo-project",
      publishableKey: "env-publishable-key",
    });
  });

  it("keeps Supabase storage API credentials optional for Postgres-only mapped content", async () => {
    await writeConfig();
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", "postgresql://env:env-pass@content.local:5432/postgres");

    const { getContentProjectContext } = await import(
      "@/lib/content-runtime/server-project-context"
    );

    await expect(getContentProjectContext("project-1")).resolves.toMatchObject({
      apiUrl: null,
      connectionString: "postgresql://env:env-pass@content.local:5432/postgres",
      publishableKey: null,
    });
  });

  it("surfaces env wording when mapped runtime has no content database URL", async () => {
    await writeConfig();

    const {
      ensureDirectConnectionForMappedRuntime,
      getContentProjectContext,
    } = await import("@/lib/content-runtime/server-project-context");
    const context = await getContentProjectContext("project-1");

    expect(context?.connectionString).toBeNull();
    expect(() => ensureDirectConnectionForMappedRuntime(context as never)).toThrow(
      "Self-host runtime requires BASEBUDDY_CONTENT_DATABASE_URL.",
    );
  });
});
