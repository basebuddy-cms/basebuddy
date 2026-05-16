import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, rpcMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

describe("member invitation preview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createAdminClientMock.mockReturnValue({
      rpc: rpcMock,
    });
  });

  it("loads the invite preview through the RPC and maps it for the public page", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          accepted_at: null,
          author_scopes: [{ cms_author_id: "author-1" }],
          expires_at: "2026-06-03T10:00:00.000Z",
          invited_email: "writer@example.com",
          project_id: "project-1",
          project_name: "Demo Project",
          project_slug: "demo-project",
          revoked_at: null,
          role_keys: ["author"],
        },
      ],
      error: null,
    });

    const { getProjectMemberInvitationPreview } = await import(
      "@/lib/control-plane/member-invitations-server"
    );

    await expect(getProjectMemberInvitationPreview(" invite-token-123 ")).resolves.toEqual({
      acceptedAt: null,
      authorScopes: [{ cmsAuthorId: "author-1", canPublish: true }],
      expiresAt: "2026-06-03T10:00:00.000Z",
      invitePath: "/invite/invite-token-123",
      invitedEmail: "writer@example.com",
      projectId: "project-1",
      projectName: "Demo Project",
      projectSlug: "demo-project",
      revokedAt: null,
      roles: ["author"],
      status: "pending",
    });

    expect(rpcMock).toHaveBeenCalledWith("get_project_member_invitation_preview", {
      p_public_token: "invite-token-123",
    });
  });

  it("returns null and logs when the preview RPC fails", async () => {
    const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST000",
        message: "preview lookup failed",
      },
    });

    const { getProjectMemberInvitationPreview } = await import(
      "@/lib/control-plane/member-invitations-server"
    );

    await expect(getProjectMemberInvitationPreview("invite-token-123")).resolves.toBeNull();
    expect(consoleErrorMock).toHaveBeenCalled();

    consoleErrorMock.mockRestore();
  });
});
