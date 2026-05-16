import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  enforceRateLimitMock,
  invalidateControlPlaneRuntimeCacheMock,
  invalidateContentProjectContextCachesMock,
  requireAuthenticatedApiUserMock,
  rpcMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  enforceRateLimitMock: vi.fn(() => null),
  invalidateControlPlaneRuntimeCacheMock: vi.fn(),
  invalidateContentProjectContextCachesMock: vi.fn(),
  requireAuthenticatedApiUserMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/api/api-auth", () => ({
  requireAuthenticatedApiUser: requireAuthenticatedApiUserMock,
}));

vi.mock("@/lib/api/request-guards", () => ({
  enforceRateLimit: enforceRateLimitMock,
  enforceSameOriginRequest: vi.fn(() => null),
}));

vi.mock("@/lib/control-plane/server-runtime-cache", () => ({
  invalidateControlPlaneRuntimeCache: invalidateControlPlaneRuntimeCacheMock,
}));

vi.mock("@/lib/content-runtime/server-project-context", () => ({
  invalidateContentProjectContextCaches: invalidateContentProjectContextCachesMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST as postMemberInvitationAcceptRoute } from "@/app/api/member-invitations/[publicToken]/route";

describe("member invitation accept route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAuthenticatedApiUserMock.mockResolvedValue({
      account: null,
      errorResponse: null,
      supabase: {},
      user: { id: "user-1" },
    });
    rpcMock.mockResolvedValue({
      data: [
        {
          membership_status: "accepted",
          project_id: "project-1",
          project_slug: "demo-project",
        },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue({
      rpc: rpcMock,
    });
  });

  it("accepts an invitation and returns the project redirect payload", async () => {
    const response = await postMemberInvitationAcceptRoute(
      new Request("http://localhost/api/member-invitations/invite-token-123", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ publicToken: "invite-token-123" }),
      },
    );

    expect(requireAuthenticatedApiUserMock).toHaveBeenCalledWith({
      ensurePreparedProfile: true,
      unauthenticatedMessage: "Sign in with the invited email address to accept this invitation.",
    });
    expect(rpcMock).toHaveBeenCalledWith("accept_project_member_invitation", {
      p_public_token: "invite-token-123",
    });
    expect(invalidateControlPlaneRuntimeCacheMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(invalidateContentProjectContextCachesMock).toHaveBeenCalledWith("project-1");
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/projects/demo-project",
      status: "accepted",
    });
  });

  it("short-circuits with the auth failure response when the visitor is not signed in", async () => {
    requireAuthenticatedApiUserMock.mockResolvedValue({
      account: null,
      errorResponse: Response.json({ error: "Please sign in to continue." }, { status: 401 }),
      supabase: {},
      user: null,
    });

    const response = await postMemberInvitationAcceptRoute(
      new Request("http://localhost/api/member-invitations/invite-token-123", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ publicToken: "invite-token-123" }),
      },
    );

    expect(createClientMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("does not write the full invitation token to server logs when acceptance fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("Invitation token lookup failed."),
    });

    const response = await postMemberInvitationAcceptRoute(
      new Request("http://localhost/api/member-invitations/sensitive-token-123", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ publicToken: "sensitive-token-123" }),
      },
    );

    expect(response.status).toBe(400);
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain("sensitive-token-123");
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).toContain("en-123");

    consoleErrorSpy.mockRestore();
  });
});
