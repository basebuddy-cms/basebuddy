import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

describe("control-plane server bootstrap helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("prepares the signed-in profile before listing projects", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const projectMemberships = [
      {
        role_key: "author",
        projects: {
          created_at: "2026-03-30T00:00:00.000Z",
          id: "project-1",
          name: "Demo Project",
          slug: "demo-project",
          website_url: null,
        },
      },
      {
        role_key: "editor",
        projects: {
          created_at: "2026-03-30T00:00:00.000Z",
          id: "project-1",
          name: "Demo Project",
          slug: "demo-project",
          website_url: null,
        },
      },
    ];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "basebuddy_profiles") {
          return {
            upsert,
          };
        }

        if (table === "basebuddy_project_member_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: projectMemberships,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const user = {
      email: "author@example.com",
      id: "user-1",
      user_metadata: {},
    };

    const { listProjectsForUser } = await import("@/lib/control-plane/server");

    await expect(listProjectsForUser(supabase as never, user as never)).resolves.toEqual({
      hasMoreProjects: false,
      projectSearchQuery: "",
      projects: [
        {
          createdAt: "2026-03-30T00:00:00.000Z",
          id: "project-1",
          name: "Demo Project",
          role: "editor",
          slug: "demo-project",
          websiteUrl: null,
        },
      ],
      setupRequired: false,
    });

    expect(upsert).toHaveBeenCalledWith(
      {
        email: "author@example.com",
        id: "user-1",
      },
      {
        onConflict: "id",
      },
    );
  });

  it("prepares the signed-in profile before loading a project by slug", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const eqProjectSlug = vi.fn(async () => ({
      data: [
        {
          role_key: "author",
          projects: {
            created_at: "2026-03-30T00:00:00.000Z",
            id: "project-1",
            name: "Demo Project",
            slug: "demo-project",
            website_url: null,
          },
        },
      ],
      error: null,
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "basebuddy_profiles") {
          return {
            upsert,
          };
        }

        if (table === "basebuddy_project_member_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((column: string) => {
                if (column === "user_id") {
                  return {
                    eq: eqProjectSlug,
                  };
                }

                throw new Error(`Unexpected filter ${column}`);
              }),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const user = {
      email: "author@example.com",
      id: "user-1",
      user_metadata: {},
    };

    const { getProjectForUserBySlug } = await import("@/lib/control-plane/server");

    await expect(
      getProjectForUserBySlug(supabase as never, user as never, "demo-project"),
    ).resolves.toEqual({
      project: {
        createdAt: "2026-03-30T00:00:00.000Z",
        id: "project-1",
        name: "Demo Project",
        role: "author",
        slug: "demo-project",
        websiteUrl: null,
      },
      setupRequired: false,
    });

    expect(upsert).toHaveBeenCalledWith(
      {
        email: "author@example.com",
        id: "user-1",
      },
      {
        onConflict: "id",
      },
    );
    expect(eqProjectSlug).toHaveBeenCalledWith("projects.slug", "demo-project");
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
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
        }),
      },
    } as never);

    const { getAuthenticatedApiRequestContext } = await import("@/lib/control-plane/server");

    await expect(getAuthenticatedApiRequestContext()).resolves.toEqual({
      errorMessage: "Please sign in to continue.",
      ok: false,
      status: 401,
      supabase: expect.any(Object),
      user: null,
    });
  });

  it("returns prepared authenticated API context when profile prep succeeds", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const authGetUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          email: "editor@example.com",
          id: "user-1",
          user_metadata: {
            avatar_url: "https://example.com/editor.png",
            full_name: "Editor User",
          },
        },
      },
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: authGetUser,
      },
      from: vi.fn(() => ({
        upsert,
      })),
    } as never);

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

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("returns an optional signed-in account without redirecting when a user exists", async () => {
    const authGetUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          email: "owner@example.com",
          id: "user-1",
          user_metadata: {
            avatar_url: "https://example.com/owner.png",
            full_name: "Owner User",
          },
        },
      },
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: authGetUser,
      },
    } as never);

    const { getOptionalAuthenticatedUserWithAccount } = await import("@/lib/control-plane/server");

    await expect(getOptionalAuthenticatedUserWithAccount()).resolves.toMatchObject({
      account: {
        avatarUrl: "https://example.com/owner.png",
        email: "owner@example.com",
        name: "Owner User",
      },
      user: {
        id: "user-1",
      },
    });
  });

  it("reuses one auth session lookup across page and API auth helpers", async () => {
    const authGetUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          email: "owner@example.com",
          id: "user-1",
          user_metadata: {
            avatar_url: "https://example.com/owner.png",
            full_name: "Owner User",
          },
        },
      },
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: authGetUser,
      },
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          error: null,
        }),
      })),
    } as never);

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

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(authGetUser).toHaveBeenCalledTimes(1);
  });
});
