import { describe, expect, it } from "vitest";

import {
  buildProjectMemberInvitationLoginPath,
  buildProjectMemberInvitationPath,
  getProjectMemberInvitationRecipientState,
  getProjectMemberInvitationStatus,
  normalizeProjectMemberInvitationEmail,
} from "@/lib/control-plane/member-invitations";

describe("project member invitations", () => {
  it("normalizes invitation emails for matching and storage", () => {
    expect(normalizeProjectMemberInvitationEmail("  Writer@Example.com ")).toBe("writer@example.com");
    expect(normalizeProjectMemberInvitationEmail(null)).toBe("");
  });

  it("builds invite paths from the public token", () => {
    expect(buildProjectMemberInvitationPath("invite-token-123")).toBe("/invite/invite-token-123");
  });

  it("builds login handoff paths that preserve the invite path and invited email", () => {
    expect(buildProjectMemberInvitationLoginPath("invite-token-123", " Writer@example.com ")).toBe(
      "/login?email=Writer%40example.com&next=%2Finvite%2Finvite-token-123",
    );
  });

  it("derives the effective invitation status from acceptance, revocation, and expiry", () => {
    expect(
      getProjectMemberInvitationStatus({
        acceptedAt: null,
        expiresAt: "2026-04-03T10:00:00.000Z",
        now: "2026-04-02T10:00:00.000Z",
        revokedAt: null,
      }),
    ).toBe("pending");

    expect(
      getProjectMemberInvitationStatus({
        acceptedAt: null,
        expiresAt: "2026-04-01T10:00:00.000Z",
        now: "2026-04-02T10:00:00.000Z",
        revokedAt: null,
      }),
    ).toBe("expired");

    expect(
      getProjectMemberInvitationStatus({
        acceptedAt: null,
        expiresAt: "2026-04-03T10:00:00.000Z",
        now: "2026-04-02T10:00:00.000Z",
        revokedAt: "2026-04-02T09:00:00.000Z",
      }),
    ).toBe("revoked");

    expect(
      getProjectMemberInvitationStatus({
        acceptedAt: "2026-04-02T09:00:00.000Z",
        expiresAt: "2026-04-03T10:00:00.000Z",
        now: "2026-04-02T10:00:00.000Z",
        revokedAt: null,
      }),
    ).toBe("accepted");
  });

  it("tells the invite page whether the visitor needs auth, the wrong account, or can accept", () => {
    expect(
      getProjectMemberInvitationRecipientState({
        currentUserEmail: null,
        invitedEmail: "writer@example.com",
      }),
    ).toBe("needs_auth");

    expect(
      getProjectMemberInvitationRecipientState({
        currentUserEmail: "editor@example.com",
        invitedEmail: "writer@example.com",
      }),
    ).toBe("wrong_account");

    expect(
      getProjectMemberInvitationRecipientState({
        currentUserEmail: " Writer@Example.com ",
        invitedEmail: "writer@example.com",
      }),
    ).toBe("ready");
  });
});
