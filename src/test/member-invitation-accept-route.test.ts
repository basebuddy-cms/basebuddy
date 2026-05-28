import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import {
  createDefaultBaseBuddyConfig,
  type BaseBuddyConfig,
} from "@/lib/basebuddy-config/schema";

const {
  createClientMock,
  enforceRateLimitMock,
  invalidateControlPlaneRuntimeCacheMock,
  invalidateContentProjectContextCachesMock,
  requireAuthenticatedApiUserMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(() => {
    throw new Error("Supabase control-plane client should not be used to accept invitations.");
  }),
  enforceRateLimitMock: vi.fn(() => null),
  invalidateControlPlaneRuntimeCacheMock: vi.fn(),
  invalidateContentProjectContextCachesMock: vi.fn(),
  requireAuthenticatedApiUserMock: vi.fn(),
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


import { POST as postMemberInvitationAcceptRoute } from "@/app/api/member-invitations/[publicToken]/route";

const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

const createUser = ({
  email,
  id,
  name,
}: {
  email: string;
  id: string;
  name: string;
}) => ({
  avatarUrl: null,
  createdAt: fixedNow,
  email,
  id,
  name,
  passwordHash: "hash",
  passwordHashParams: {
    keyLength: 64,
    name: "scrypt" as const,
  },
  passwordSalt: "salt",
  updatedAt: fixedNow,
});

describe("member invitation accept route", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-invitation-accept-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();

    requireAuthenticatedApiUserMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "writer@example.com",
        name: "Writer",
      },
      errorResponse: null,
      user: { id: "user-writer" },
    });

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
    users: [
      createUser({ email: "owner@example.com", id: "user-owner", name: "Owner" }),
      createUser({ email: "writer@example.com", id: "user-writer", name: "Writer" }),
    ],
    projects: [
      {
        createdAt: fixedNow,
        createdBy: "user-owner",
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
            userId: "user-owner",
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

  const readSavedConfig = async () =>
    JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as BaseBuddyConfig;

  it("accepts an invitation from config and returns the project redirect payload", async () => {
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
    expect(createClientMock).not.toHaveBeenCalled();
    expect(invalidateControlPlaneRuntimeCacheMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(invalidateContentProjectContextCachesMock).toHaveBeenCalledWith("project-1");
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/projects/demo-project",
      status: "accepted",
    });

    const savedConfig = await readSavedConfig();
    expect(savedConfig.invitations[0]).toMatchObject({
      acceptedAt: fixedNow,
      acceptedBy: "user-writer",
    });
    expect(savedConfig.projects[0]?.members).toContainEqual(
      expect.objectContaining({
        authorScopes: [{ canPublish: false, cmsAuthorId: "author-1" }],
        roles: ["author"],
        userId: "user-writer",
      }),
    );
  });

  it("returns already_member without escalating an existing member", async () => {
    const config = createSeedConfig();
    config.projects[0]!.members.push({
      allowPermissionKeys: [],
      authorScopes: [],
      denyPermissionKeys: [],
      joinedAt: fixedNow,
      roles: ["viewer"],
      userId: "user-writer",
    });
    await writeFile(getBaseBuddyConfigPath(), JSON.stringify(config, null, 2), "utf8");

    const response = await postMemberInvitationAcceptRoute(
      new Request("http://localhost/api/member-invitations/invite-token-123", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ publicToken: "invite-token-123" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/projects/demo-project",
      status: "already_member",
    });
    expect(
      (await readSavedConfig()).projects[0]?.members.find((member) => member.userId === "user-writer"),
    ).toMatchObject({
      authorScopes: [],
      roles: ["viewer"],
    });
  });

  it("short-circuits with the auth failure response when the visitor is not signed in", async () => {
    requireAuthenticatedApiUserMock.mockResolvedValue({
      account: null,
      errorResponse: Response.json({ error: "Please sign in to continue." }, { status: 401 }),
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

  it("rejects a signed-in user with the wrong email without logging the full token", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    requireAuthenticatedApiUserMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "other@example.com",
        name: "Other",
      },
      errorResponse: null,
      user: { id: "user-writer" },
    });

    const response = await postMemberInvitationAcceptRoute(
      new Request("http://localhost/api/member-invitations/invite-token-123", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ publicToken: "invite-token-123" }),
      },
    );

    expect(response.status).toBe(403);
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain("invite-token-123");
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).toContain("en-123");

    consoleErrorSpy.mockRestore();
  });
});
