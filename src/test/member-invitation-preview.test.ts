import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import {
  createDefaultBaseBuddyConfig,
  type BaseBuddyConfig,
} from "@/lib/basebuddy-config/schema";

vi.mock("server-only", () => ({}));

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(() => {
    throw new Error("Supabase admin client should not be used for invitation preview.");
  }),
}));


const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("member invitation preview", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-invitation-preview-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.resetModules();
    vi.clearAllMocks();

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(createSeedConfig(), null, 2),
      "utf8",
    );
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const createSeedConfig = (): BaseBuddyConfig => ({
    ...createDefaultBaseBuddyConfig({
      now: fixedNow,
    }),
    projects: [
      {
        createdAt: fixedNow,
        createdBy: "user-owner",
        id: "project-1",
        mapping: null,
        mappingRevisions: [],
        members: [],
        name: "Demo Project",
        sidebar: null,
        sidebarRevisions: [],
        slug: "demo-project",
        status: "active",
        updatedAt: fixedNow,
        websiteUrl: null,
      },
    ],
    invitations: [
      {
        acceptedAt: null,
        acceptedBy: null,
        authorScopes: [{ cmsAuthorId: "author-1", canPublish: false }],
        createdAt: fixedNow,
        createdBy: "user-owner",
        expiresAt: "2026-06-03T10:00:00.000Z",
        id: "invitation-1",
        invitedEmail: "writer@example.com",
        projectId: "project-1",
        publicToken: "invite-token-123",
        revokedAt: null,
        revokedBy: null,
        roles: ["author"],
      },
    ],
  });

  it("loads the invite preview from config and maps it for the public page", async () => {
    const { getProjectMemberInvitationPreview } = await import(
      "@/lib/control-plane/member-invitations-server"
    );

    await expect(getProjectMemberInvitationPreview(" invite-token-123 ")).resolves.toEqual({
      acceptedAt: null,
      authorScopes: [{ cmsAuthorId: "author-1", canPublish: false }],
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
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns null when the token is missing or unknown", async () => {
    const { getProjectMemberInvitationPreview } = await import(
      "@/lib/control-plane/member-invitations-server"
    );

    await expect(getProjectMemberInvitationPreview(" ")).resolves.toBeNull();
    await expect(getProjectMemberInvitationPreview("missing-token")).resolves.toBeNull();
  });
});
