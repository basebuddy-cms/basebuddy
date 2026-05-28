import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => {
      const memoized = new Map<string, unknown>();

      return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);

        if (!memoized.has(key)) {
          memoized.set(key, fn(...args));
        }

        return memoized.get(key) as ReturnType<T>;
      }) as unknown as T;
    },
  };
});

const { getLocalAuthenticatedSessionFromCookiesMock } = vi.hoisted(() => ({
  getLocalAuthenticatedSessionFromCookiesMock: vi.fn(),
}));

vi.mock("@/lib/auth/local-auth", () => ({
  getLocalAuthenticatedSessionFromCookies: getLocalAuthenticatedSessionFromCookiesMock,
}));

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("control-plane server bootstrap helpers", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-control-plane-server-"));
    process.chdir(tempDir);
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
              mapping: null,
              mappingRevisions: [],
              members: [
                {
                  allowPermissionKeys: [],
                  authorScopes: [],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["author", "editor"],
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
        },
        null,
        2,
      ),
      "utf8",
    );
    getLocalAuthenticatedSessionFromCookiesMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "author@example.com",
        name: "Author",
      },
      user: {
        avatarUrl: null,
        email: "author@example.com",
        id: "user-1",
        name: "Author",
        user_metadata: {},
      },
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("lists config projects without preparing a Supabase profile", async () => {
    const { listProjectsForUser } = await import("@/lib/control-plane/server");

    await expect(
      listProjectsForUser({
        email: "author@example.com",
        id: "user-1",
        user_metadata: {},
      } as never),
    ).resolves.toEqual({
      hasMoreProjects: false,
      projectSearchQuery: "",
      projects: [
        {
          createdAt: fixedNow,
          id: "project-1",
          name: "Demo Project",
          role: "editor",
          slug: "demo-project",
          websiteUrl: null,
        },
      ],
      setupRequired: false,
    });
  });

  it("loads a config project by slug without a Supabase membership query", async () => {
    const { getProjectForUserBySlug } = await import("@/lib/control-plane/server");

    await expect(
      getProjectForUserBySlug(
        {
          email: "author@example.com",
          id: "user-1",
          user_metadata: {},
        } as never,
        "demo-project",
      ),
    ).resolves.toEqual({
      project: {
        createdAt: fixedNow,
        id: "project-1",
        name: "Demo Project",
        role: "editor",
        slug: "demo-project",
        websiteUrl: null,
      },
      setupRequired: false,
    });
  });

  it("derives account display data from auth metadata", async () => {
    const { getAuthenticatedUserAccount } = await import("@/lib/control-plane/server");

    expect(
      getAuthenticatedUserAccount({
        email: "owner@example.com",
        user_metadata: {
          avatar_url: "https://example.com/avatar.png",
          full_name: "Owner User",
        },
      } as never),
    ).toEqual({
      avatarUrl: "https://example.com/avatar.png",
      email: "owner@example.com",
      name: "Owner User",
    });
  });

  it("returns an API-safe auth error when no user is signed in", async () => {
    getLocalAuthenticatedSessionFromCookiesMock.mockResolvedValue(null);

    const { getAuthenticatedApiRequestContext } = await import("@/lib/control-plane/server");

    await expect(getAuthenticatedApiRequestContext()).resolves.toEqual({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      user: null,
    });
  });

  it("returns prepared authenticated API context from the local session", async () => {
    getLocalAuthenticatedSessionFromCookiesMock.mockResolvedValue({
      account: null,
      user: {
        avatarUrl: "https://example.com/editor.png",
        email: "editor@example.com",
        id: "user-1",
        name: "Editor User",
        user_metadata: {},
      },
    });

    const { getAuthenticatedApiRequestContext } = await import("@/lib/control-plane/server");

    await expect(
      getAuthenticatedApiRequestContext({
        ensurePreparedProfile: true,
      }),
    ).resolves.toMatchObject({
      account: {
        avatarUrl: "https://example.com/editor.png",
        email: "editor@example.com",
        name: "Editor User",
      },
      ok: true,
      user: {
        id: "user-1",
      },
    });
  });

  it("returns an optional signed-in account without redirecting when a user exists", async () => {
    const { getOptionalAuthenticatedUserWithAccount } = await import("@/lib/control-plane/server");

    await expect(getOptionalAuthenticatedUserWithAccount()).resolves.toMatchObject({
      account: {
        avatarUrl: null,
        email: "author@example.com",
        name: "Author",
      },
      user: {
        id: "user-1",
      },
    });
  });

  it("reuses one local session lookup across page and API auth helpers", async () => {
    const {
      getAuthenticatedApiRequestContext,
      getOptionalAuthenticatedUserWithAccount,
      requireAuthenticatedUserWithAccount,
    } = await import("@/lib/control-plane/server");

    await expect(requireAuthenticatedUserWithAccount()).resolves.toMatchObject({
      user: {
        id: "user-1",
      },
    });
    await expect(getOptionalAuthenticatedUserWithAccount()).resolves.toMatchObject({
      user: {
        id: "user-1",
      },
    });
    await expect(
      getAuthenticatedApiRequestContext({
        ensurePreparedProfile: true,
      }),
    ).resolves.toMatchObject({
      ok: true,
      user: {
        id: "user-1",
      },
    });

    expect(getLocalAuthenticatedSessionFromCookiesMock).toHaveBeenCalledTimes(1);
  });
});
