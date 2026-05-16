import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  getProfileSettingsPageBootstrap,
  getProjectForUserBySlug,
  listProjectsForUser,
} from "@/lib/control-plane/server";
import { createClient } from "@/lib/supabase/server";

describe("control-plane page bootstrap queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists projects from a single membership join query", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const membershipQueryResult = Promise.resolve({
      data: [
        {
          role_key: "editor",
          projects: {
            created_at: "2026-03-20T00:00:00.000Z",
            id: "project-2",
            name: "Second",
            slug: "second",
            website_url: null,
          },
        },
        {
          role_key: "owner",
          projects: {
            created_at: "2026-03-27T00:00:00.000Z",
            id: "project-1",
            name: "First",
            slug: "first",
            website_url: "https://first.example.com",
          },
        },
      ],
      error: null,
    });

    const limit = vi.fn().mockReturnValue(membershipQueryResult);
    const order = vi.fn(() => ({
      limit,
    }));
    const membershipBuilder = {
      eq: vi.fn(() => ({
        order,
      })),
    };
    const select = vi.fn(() => membershipBuilder);
    const from = vi.fn((table: string) => {
      if (table === "basebuddy_profiles") {
        return {
          upsert,
        };
      }

      if (table !== "basebuddy_project_member_roles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select,
      };
    });

    await expect(
      listProjectsForUser(
        {
          from,
        } as never,
        {
          id: "user-1",
        } as never,
      ),
    ).resolves.toEqual({
      hasMoreProjects: false,
      projects: [
        {
          createdAt: "2026-03-27T00:00:00.000Z",
          id: "project-1",
          name: "First",
          role: "owner",
          slug: "first",
          websiteUrl: "https://first.example.com",
        },
        {
          createdAt: "2026-03-20T00:00:00.000Z",
          id: "project-2",
          name: "Second",
          role: "editor",
          slug: "second",
          websiteUrl: null,
        },
      ],
      projectSearchQuery: "",
      setupRequired: false,
    });

    expect(select).toHaveBeenCalledWith(
      "role_key, projects:basebuddy_projects!inner(id, name, slug, website_url, created_at)",
    );
    expect(membershipBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("created_at", {
      ascending: false,
      referencedTable: "projects",
    });
    expect(limit).toHaveBeenCalledWith(241);
    expect(upsert).toHaveBeenCalledWith(
      {
        email: null,
        id: "user-1",
      },
      {
        onConflict: "id",
      },
    );
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("bounds and searches the project list query", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const membershipQueryResult = Promise.resolve({
      data: [],
      error: null,
    });

    const limit = vi.fn().mockReturnValue(membershipQueryResult);
    const order = vi.fn(() => ({
      limit,
    }));
    const or = vi.fn(() => ({
      order,
    }));
    const membershipBuilder = {
      eq: vi.fn(() => ({
        or,
      })),
    };
    const select = vi.fn(() => membershipBuilder);
    const from = vi.fn((table: string) => {
      if (table === "basebuddy_profiles") {
        return {
          upsert,
        };
      }

      if (table !== "basebuddy_project_member_roles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select,
      };
    });

    await expect(
      listProjectsForUser(
        {
          from,
        } as never,
        {
          id: "user-1",
        } as never,
        {
          limit: 24,
          search: "Acme Labs",
        },
      ),
    ).resolves.toEqual({
      hasMoreProjects: false,
      projects: [],
      projectSearchQuery: "Acme Labs",
      setupRequired: false,
    });

    expect(or).toHaveBeenCalledWith("name.ilike.%Acme Labs%,slug.ilike.%Acme Labs%", {
      referencedTable: "projects",
    });
    expect(order).toHaveBeenCalledWith("created_at", {
      ascending: false,
      referencedTable: "projects",
    });
    expect(limit).toHaveBeenCalledWith(121);
  });

  it("loads a project by slug from a single membership join query", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const membershipQueryResult = Promise.resolve({
      data: [
        {
          role_key: "viewer",
          projects: {
            created_at: "2026-03-27T00:00:00.000Z",
            id: "project-1",
            name: "First",
            slug: "first",
            website_url: "https://first.example.com",
          },
        },
        {
          role_key: "owner",
          projects: {
            created_at: "2026-03-27T00:00:00.000Z",
            id: "project-1",
            name: "First",
            slug: "first",
            website_url: "https://first.example.com",
          },
        },
      ],
      error: null,
    });
    const membershipBuilder = {
      eq: vi
        .fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue(membershipQueryResult),
        }),
    };
    const select = vi.fn(() => membershipBuilder);
    const from = vi.fn((table: string) => {
      if (table === "basebuddy_profiles") {
        return {
          upsert,
        };
      }

      if (table !== "basebuddy_project_member_roles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select,
      };
    });

    await expect(
      getProjectForUserBySlug(
        {
          from,
        } as never,
        {
          id: "user-1",
        } as never,
        "First",
      ),
    ).resolves.toEqual({
      project: {
        createdAt: "2026-03-27T00:00:00.000Z",
        id: "project-1",
        name: "First",
        role: "owner",
        slug: "first",
        websiteUrl: "https://first.example.com",
      },
      setupRequired: false,
    });

    expect(select).toHaveBeenCalledWith(
      "role_key, projects:basebuddy_projects!inner(id, name, slug, website_url, created_at)",
    );
    expect(upsert).toHaveBeenCalledWith(
      {
        email: null,
        id: "user-1",
      },
      {
        onConflict: "id",
      },
    );
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("retries a project-by-slug membership lookup once when the first join result is temporarily empty", async () => {
    vi.useFakeTimers();

    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const membershipQuery = vi
      .fn()
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            role_key: "owner",
            projects: {
              created_at: "2026-03-27T00:00:00.000Z",
              id: "project-1",
              name: "First",
              slug: "first",
              website_url: "https://first.example.com",
            },
          },
        ],
        error: null,
      });
    const membershipBuilder = {
      eq: vi.fn((column: string, value: string) => {
        if (column === "user_id") {
          expect(value).toBe("user-1");

          return {
            eq: vi.fn((nestedColumn: string, nestedValue: string) => {
              expect(nestedColumn).toBe("projects.slug");
              expect(nestedValue).toBe("first");

              return membershipQuery();
            }),
          };
        }

        throw new Error(`Unexpected filter ${column}`);
      }),
    };
    const select = vi.fn(() => membershipBuilder);
    const from = vi.fn((table: string) => {
      if (table === "basebuddy_profiles") {
        return {
          upsert,
        };
      }

      if (table !== "basebuddy_project_member_roles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select,
      };
    });

    const resultPromise = getProjectForUserBySlug(
      {
        from,
      } as never,
      {
        id: "user-1",
      } as never,
      "First",
    );

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      project: {
        createdAt: "2026-03-27T00:00:00.000Z",
        id: "project-1",
        name: "First",
        role: "owner",
        slug: "first",
        websiteUrl: "https://first.example.com",
      },
      setupRequired: false,
    });

    expect(membershipQuery).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("treats a missing project membership relationship as incomplete setup", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const joinError = {
      code: "PGRST200",
      details: "Searched for a foreign key relationship between basebuddy_project_member_roles and basebuddy_projects in the schema cache, but no matches were found.",
      message: "Could not find a relationship between 'basebuddy_project_member_roles' and 'basebuddy_projects' in the schema cache",
    };
    const limit = vi.fn().mockResolvedValue({
        data: null,
        error: joinError,
      });
    const order = vi.fn(() => ({
      limit,
    }));
    const membershipJoinBuilder = {
      eq: vi.fn(() => ({
        order,
      })),
    };
    const select = vi.fn((clause: string) => {
      if (clause === "role_key, projects:basebuddy_projects!inner(id, name, slug, website_url, created_at)") {
        return membershipJoinBuilder;
      }

      throw new Error(`Unexpected select clause ${clause}`);
    });
    const from = vi.fn((table: string) => {
      if (table === "basebuddy_profiles") {
        return {
          upsert,
        };
      }

      return {
        select,
      };
    });

    await expect(
      listProjectsForUser(
        {
          from,
        } as never,
        {
          id: "user-1",
        } as never,
      ),
    ).resolves.toEqual({
      hasMoreProjects: false,
      projects: [],
      projectSearchQuery: "",
      setupRequired: true,
    });

    expect(from).toHaveBeenCalledWith("basebuddy_project_member_roles");
    expect(from).toHaveBeenCalledWith("basebuddy_profiles");
  });

  it("treats a missing slug membership relationship as incomplete setup", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    const joinError = {
      code: "PGRST200",
      message: "Could not find a relationship between 'basebuddy_project_member_roles' and 'basebuddy_projects' in the schema cache",
    };
    const joinedSlugEq = vi.fn().mockResolvedValue({
      data: null,
      error: joinError,
    });
    const joinedUserEq = vi.fn(() => ({
      eq: joinedSlugEq,
    }));
    const select = vi.fn((clause: string) => {
      if (clause === "role_key, projects:basebuddy_projects!inner(id, name, slug, website_url, created_at)") {
        return {
          eq: joinedUserEq,
        };
      }

      throw new Error(`Unexpected select clause ${clause}`);
    });
    const from = vi.fn((table: string) => {
      if (table === "basebuddy_profiles") {
        return {
          upsert,
        };
      }

      return {
        select,
      };
    });

    await expect(
      getProjectForUserBySlug(
        {
          from,
        } as never,
        {
          id: "user-1",
        } as never,
        "First",
      ),
    ).resolves.toEqual({
      project: null,
      setupRequired: true,
    });

    expect(joinedUserEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(joinedSlugEq).toHaveBeenCalledWith("projects.slug", "first");
    expect(from).toHaveBeenCalledWith("basebuddy_profiles");
  });

  it("loads profile settings from a read-only profile query without preparing the profile", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        avatar_url: "https://example.com/profile.png",
        email: "owner@example.com",
        name: "Owner Profile",
      },
      error: null,
    });
    const eq = vi.fn(() => ({
      maybeSingle,
    }));
    const select = vi.fn(() => ({
      eq,
    }));
    const from = vi.fn(() => ({
      select,
      upsert: vi.fn(() => {
        throw new Error("Profile page should not upsert on read.");
      }),
    }));

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              email: "owner@example.com",
              id: "user-1",
              user_metadata: {
                avatar_url: "https://example.com/auth-avatar.png",
                full_name: "Auth Owner",
              },
            },
          },
        }),
      },
      from,
    } as never);

    await expect(getProfileSettingsPageBootstrap()).resolves.toEqual({
      avatarUrl: "https://example.com/profile.png",
      email: "owner@example.com",
      errorMessage: undefined,
      name: "Owner Profile",
      setupRequired: false,
    });

    expect(select).toHaveBeenCalledWith("email, name, avatar_url");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
