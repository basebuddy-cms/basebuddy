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
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
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
import {
  getProfileSettingsPageBootstrap,
  getProjectForUserBySlug,
  listProjectsForUser,
} from "@/lib/control-plane/server";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("control-plane page bootstrap queries", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-control-plane-page-"));
    process.chdir(tempDir);
    vi.clearAllMocks();
    getLocalAuthenticatedSessionFromCookiesMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      user: {
        avatarUrl: null,
        email: "owner@example.com",
        id: "user-1",
        name: "Owner",
        user_metadata: {},
      },
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
              createdAt: "2026-05-20T00:00:00.000Z",
              createdBy: "user-1",
              id: "project-older",
              mapping: null,
              mappingRevisions: [],
              members: [
                {
                  allowPermissionKeys: [],
                  authorScopes: [],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["viewer", "editor"],
                  userId: "user-1",
                },
              ],
              name: "Older Project",
              sidebar: null,
              sidebarRevisions: [],
              slug: "older-project",
              status: "active",
              updatedAt: fixedNow,
              websiteUrl: null,
            },
            {
              createdAt: "2026-05-27T00:00:00.000Z",
              createdBy: "user-1",
              id: "project-newer",
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
              name: "Acme Newer Project",
              sidebar: null,
              sidebarRevisions: [],
              slug: "acme-newer-project",
              status: "active",
              updatedAt: fixedNow,
              websiteUrl: "https://newer.example.com",
            },
            {
              createdAt: "2026-05-28T00:00:00.000Z",
              createdBy: "user-2",
              id: "project-other",
              mapping: null,
              mappingRevisions: [],
              members: [
                {
                  allowPermissionKeys: [],
                  authorScopes: [],
                  denyPermissionKeys: [],
                  joinedAt: fixedNow,
                  roles: ["owner"],
                  userId: "user-2",
                },
              ],
              name: "Other User Project",
              sidebar: null,
              sidebarRevisions: [],
              slug: "other-user-project",
              status: "active",
              updatedAt: fixedNow,
              websiteUrl: null,
            },
          ],
          users: [
            {
              avatarUrl: "https://example.com/profile.png",
              createdAt: fixedNow,
              email: "owner@example.com",
              id: "user-1",
              name: "Owner Profile",
              passwordHash: "password-hash",
              passwordHashParams: {
                keyLength: 64,
                name: "scrypt",
              },
              passwordSalt: "password-salt",
              updatedAt: fixedNow,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("lists projects from config for the signed-in member", async () => {
    await expect(
      listProjectsForUser({
        id: "user-1",
      } as never),
    ).resolves.toEqual({
      hasMoreProjects: false,
      projects: [
        {
          createdAt: "2026-05-27T00:00:00.000Z",
          id: "project-newer",
          name: "Acme Newer Project",
          role: "owner",
          slug: "acme-newer-project",
          websiteUrl: "https://newer.example.com",
        },
        {
          createdAt: "2026-05-20T00:00:00.000Z",
          id: "project-older",
          name: "Older Project",
          role: "editor",
          slug: "older-project",
          websiteUrl: null,
        },
      ],
      projectSearchQuery: "",
      setupRequired: false,
    });
  });

  it("bounds and searches the config project list", async () => {
    await expect(
      listProjectsForUser(
        {
          id: "user-1",
        } as never,
        {
          limit: 1,
          search: "Acme",
        },
      ),
    ).resolves.toEqual({
      hasMoreProjects: false,
      projects: [
        {
          createdAt: "2026-05-27T00:00:00.000Z",
          id: "project-newer",
          name: "Acme Newer Project",
          role: "owner",
          slug: "acme-newer-project",
          websiteUrl: "https://newer.example.com",
        },
      ],
      projectSearchQuery: "Acme",
      setupRequired: false,
    });
  });

  it("loads a project by slug from config", async () => {
    await expect(
      getProjectForUserBySlug(
        {
          id: "user-1",
        } as never,
        "Acme Newer Project",
      ),
    ).resolves.toEqual({
      project: {
        createdAt: "2026-05-27T00:00:00.000Z",
        id: "project-newer",
        name: "Acme Newer Project",
        role: "owner",
        slug: "acme-newer-project",
        websiteUrl: "https://newer.example.com",
      },
      setupRequired: false,
    });
  });

  it("returns null when the user has no config membership for the project", async () => {
    await expect(
      getProjectForUserBySlug(
        {
          id: "user-1",
        } as never,
        "other-user-project",
      ),
    ).resolves.toEqual({
      project: null,
      setupRequired: false,
    });
  });

  it("loads profile settings from the local config session without preparing a Supabase profile", async () => {
    getLocalAuthenticatedSessionFromCookiesMock.mockResolvedValue({
      account: null,
      user: {
        avatarUrl: "https://example.com/profile.png",
        email: "owner@example.com",
        id: "user-1",
        name: "Owner Profile",
        user_metadata: {},
      },
    });
    await expect(getProfileSettingsPageBootstrap()).resolves.toEqual({
      avatarUrl: "https://example.com/profile.png",
      email: "owner@example.com",
      errorMessage: undefined,
      name: "Owner Profile",
      setupRequired: false,
      userId: "user-1",
    });

  });
});
