import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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

const { getContentAuthorOptionsMock, withAuthenticatedPreparedProjectRouteMock, withAuthenticatedProjectRouteMock } =
  vi.hoisted(() => ({
    getContentAuthorOptionsMock: vi.fn(),
    withAuthenticatedPreparedProjectRouteMock: vi.fn(
      (
        handler: (
          request: Request,
          context: {
            projectId: string;
            supabase: {
              from: ReturnType<typeof vi.fn>;
              rpc: ReturnType<typeof vi.fn>;
            };
            user: { id: string };
          },
        ) => Promise<Response>,
      ) =>
        (request: Request) =>
          handler(request, {
            projectId: "project-1",
            supabase: testSupabase,
            user: { id: "user-1" },
          }),
    ),
    withAuthenticatedProjectRouteMock: vi.fn(
      (
        handler: (
          request: Request,
          context: {
            projectId: string;
            supabase: {
              from: ReturnType<typeof vi.fn>;
              rpc: ReturnType<typeof vi.fn>;
            };
            user: { id: string };
          },
        ) => Promise<Response>,
      ) =>
        (request: Request) =>
          handler(request, {
            projectId: "project-1",
            supabase: testSupabase,
            user: { id: "user-1" },
          }),
    ),
  }));

const testSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/api/project-api-auth", () => ({
  withAuthenticatedPreparedProjectRoute: withAuthenticatedPreparedProjectRouteMock,
  withAuthenticatedProjectRoute: withAuthenticatedProjectRouteMock,
}));

vi.mock("@/lib/content-runtime/server", () => ({
  getContentAuthorOptions: getContentAuthorOptionsMock,
}));

import {
  GET as getMemberInvitationsRoute,
  POST as postMemberInvitationsRoute,
} from "@/app/api/projects/[projectId]/member-invitations/route";
import {
  GET as getMembersRoute,
  PATCH as patchMembersRoute,
} from "@/app/api/projects/[projectId]/members/route";

describe("project member route performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getContentAuthorOptionsMock.mockResolvedValue([]);
    testSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })),
    });
    testSupabase.rpc.mockImplementation((fn: string) => {
      if (fn === "get_current_project_member_access") {
        return Promise.resolve({
          data: [{ permission_keys: ["member.read", "member.invite", "member.manage"] }],
          error: null,
        });
      }

      return Promise.resolve({
        data: [],
        error: null,
      });
    });
  });

  it("passes a bounded page window to the project members RPC", async () => {
    const response = await getMembersRoute(
      new Request("http://localhost/api/projects/project-1/members?page=3&pageSize=50"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    expect(testSupabase.rpc).toHaveBeenCalledWith("get_project_members", {
      p_limit: 51,
      p_offset: 100,
      p_project_id: "project-1",
    });
  });

  it("passes a bounded page window to the project invitations RPC", async () => {
    const response = await getMemberInvitationsRoute(
      new Request("http://localhost/api/projects/project-1/member-invitations?page=2&pageSize=25"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    expect(testSupabase.rpc).toHaveBeenCalledWith("get_project_member_invitations", {
      p_limit: 26,
      p_offset: 25,
      p_project_id: "project-1",
    });
  });

  it("returns per-author publish access for member author scopes", async () => {
    testSupabase.rpc.mockImplementation((fn: string) => {
      if (fn === "get_current_project_member_access") {
        return Promise.resolve({
          data: [{ permission_keys: ["member.read", "member.manage"], role_keys: ["owner"] }],
          error: null,
        });
      }

      if (fn === "get_project_members") {
        return Promise.resolve({
          data: [
            {
              author_scopes: [
                { cmsAuthorId: "author-1", canPublish: true },
                { cms_author_id: "author-2", can_publish: false },
              ],
              avatar_url: null,
              email: "writer@example.com",
              joined_at: "2026-04-01T00:00:00.000Z",
              name: "Writer",
              role_keys: ["author"],
              user_id: "user-2",
            },
          ],
          error: null,
        });
      }

      return Promise.resolve({ data: [], error: null });
    });

    const response = await getMembersRoute(
      new Request("http://localhost/api/projects/project-1/members"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      members: [
        {
          authorScopes: [
            { cmsAuthorId: "author-1", canPublish: true },
            { cmsAuthorId: "author-2", canPublish: false },
          ],
        },
      ],
    });
  });

  it("preserves per-author publish access when updating a member", async () => {
    const response = await patchMembersRoute(
      new Request("http://localhost/api/projects/project-1/members", {
        body: JSON.stringify({
          action: "update_member",
          authorScopes: [{ cmsAuthorId: "author-1", canPublish: false }],
          roles: ["author"],
          userId: "user-2",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    expect(testSupabase.rpc).toHaveBeenCalledWith("update_project_member_access", {
      p_author_scopes: [{ cmsAuthorId: "author-1", canPublish: false }],
      p_project_id: "project-1",
      p_roles: ["author"],
      p_user_id: "user-2",
    });
  });

  it("preserves per-author publish access when creating an invite link", async () => {
    const response = await postMemberInvitationsRoute(
      new Request("http://localhost/api/projects/project-1/member-invitations", {
        body: JSON.stringify({
          authorScopes: [{ cmsAuthorId: "author-1", canPublish: false }],
          email: "writer@example.com",
          roles: ["author"],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    expect(testSupabase.rpc).toHaveBeenCalledWith("create_project_member_invitation", {
      p_author_scopes: [{ cmsAuthorId: "author-1", canPublish: false }],
      p_email: "writer@example.com",
      p_project_id: "project-1",
      p_public_token: expect.any(String),
      p_roles: ["author"],
    });
  });
});
