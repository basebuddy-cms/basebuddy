import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import {
  createDefaultBaseBuddyConfig,
  type BaseBuddyConfig,
} from "@/lib/basebuddy-config/schema";
import { getConfigProjectMemberAccess } from "@/lib/basebuddy-config/projects";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const {
  createClientMock,
  routeContextState,
  tokenMock,
  withAuthenticatedPreparedProjectRouteMock,
} = vi.hoisted(() => {
  const state = {
    projectId: "project-1",
    user: { id: "user-owner" },
    account: {
      avatarUrl: null,
      email: "owner@example.com",
      name: "Owner",
    },
    memberAccess: {
      authorScopes: [],
      permissions: ["member.invite", "member.manage", "project.read"],
      roles: ["owner"],
    },
    project: {
      createdAt: "2026-05-28T00:00:00.000Z",
      id: "project-1",
      name: "Demo Project",
      role: "owner",
      slug: "demo-project",
      websiteUrl: null,
    },
  };

  return {
    createClientMock: vi.fn(() => {
      throw new Error("Supabase control-plane client should not be used for invitations.");
    }),
    routeContextState: state,
    tokenMock: vi.fn(() => "generated-token-123"),
    withAuthenticatedPreparedProjectRouteMock: vi.fn(
      (
        handler: (
          request: Request,
          context: typeof state,
        ) => Promise<Response>,
      ) =>
        (request: Request) =>
          handler(request, state),
    ),
  };
});


vi.mock("@/lib/api/project-api-auth", () => ({
  withAuthenticatedPreparedProjectRoute: withAuthenticatedPreparedProjectRouteMock,
}));

vi.mock("@/lib/control-plane/member-invitations-server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/control-plane/member-invitations-server")>(
    "@/lib/control-plane/member-invitations-server",
  );

  return {
    ...actual,
    createProjectMemberInvitationToken: tokenMock,
  };
});

import {
  GET as getInvitationsRoute,
  POST as postInvitationsRoute,
} from "@/app/api/projects/[projectId]/member-invitations/route";
import {
  DELETE as deleteInvitationRoute,
} from "@/app/api/projects/[projectId]/member-invitations/[invitationId]/route";

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

describe("project member invitation routes", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-invitations-route-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();
    tokenMock.mockReturnValue("generated-token-123");

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(createSeedConfig(), null, 2),
      "utf8",
    );
    await setRouteUser("user-owner");
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
      createUser({ email: "admin@example.com", id: "user-admin", name: "Admin" }),
      createUser({ email: "viewer@example.com", id: "user-viewer", name: "Viewer" }),
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
          {
            allowPermissionKeys: [],
            authorScopes: [],
            denyPermissionKeys: [],
            joinedAt: fixedNow,
            roles: ["admin"],
            userId: "user-admin",
          },
          {
            allowPermissionKeys: [],
            authorScopes: [],
            denyPermissionKeys: [],
            joinedAt: fixedNow,
            roles: ["viewer"],
            userId: "user-viewer",
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
        createdAt: "2026-05-27T00:00:00.000Z",
        createdBy: "user-owner",
        expiresAt: "2026-06-03T00:00:00.000Z",
        id: "invitation-1",
        invitedEmail: "writer@example.com",
        projectId: "project-1",
        publicToken: "invite-token-001",
        revokedAt: null,
        revokedBy: null,
        roles: ["author"],
      },
      {
        acceptedAt: null,
        acceptedBy: null,
        authorScopes: [],
        createdAt: "2026-05-26T00:00:00.000Z",
        createdBy: "user-owner",
        expiresAt: "2026-06-03T00:00:00.000Z",
        id: "invitation-2",
        invitedEmail: "reader@example.com",
        projectId: "project-1",
        publicToken: "invite-token-002",
        revokedAt: null,
        revokedBy: null,
        roles: ["viewer"],
      },
    ],
  });

  const readSavedConfig = async () =>
    JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as BaseBuddyConfig;

  const setRouteUser = async (userId: string) => {
    const config = await readSavedConfig();
    const project = config.projects[0]!;
    const member = project.members.find((candidate) => candidate.userId === userId)!;
    const user = config.users.find((candidate) => candidate.id === userId)!;
    const access = getConfigProjectMemberAccess(member);

    routeContextState.user = { id: userId };
    routeContextState.account = {
      avatarUrl: user.avatarUrl,
      email: user.email,
      name: user.name,
    };
    routeContextState.memberAccess = access;
    routeContextState.project = {
      createdAt: project.createdAt,
      id: project.id,
      name: project.name,
      role: access.roles.includes("owner") ? "owner" : access.roles.includes("admin") ? "admin" : "viewer",
      slug: project.slug,
      websiteUrl: project.websiteUrl,
    };
  };

  it("lists project invitations from config with bounded paging", async () => {
    const response = await getInvitationsRoute(
      new Request("http://localhost/api/projects/project-1/member-invitations?page=1&pageSize=1"),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      hasMoreInvitations: true,
      invitationPage: 1,
      invitationPageSize: 1,
      invitations: [
        {
          authorScopes: [{ cmsAuthorId: "author-1", canPublish: false }],
          invitationId: "invitation-1",
          invitePath: "/invite/invite-token-001",
          invitedEmail: "writer@example.com",
          roles: ["author"],
          status: "pending",
        },
      ],
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("creates and revokes invitations in config", async () => {
    const createResponse = await postInvitationsRoute(
      new Request("http://localhost/api/projects/project-1/member-invitations", {
        body: JSON.stringify({
          authorScopes: [{ cmsAuthorId: "author-2", canPublish: false }],
          email: "second-writer@example.com",
          roles: ["author"],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(createResponse.status).toBe(200);
    const createdInvitation = (await readSavedConfig()).invitations.find(
      (invitation) => invitation.invitedEmail === "second-writer@example.com",
    );
    expect(createdInvitation).toMatchObject({
      authorScopes: [{ canPublish: false, cmsAuthorId: "author-2" }],
      createdBy: "user-owner",
      expiresAt: "2026-06-11T00:00:00.000Z",
      publicToken: "generated-token-123",
      roles: ["author"],
    });

    const deleteResponse = await deleteInvitationRoute(
      new Request(`http://localhost/api/projects/project-1/member-invitations/${createdInvitation!.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ projectId: "project-1", invitationId: createdInvitation!.id }) },
    );

    expect(deleteResponse.status).toBe(200);
    expect(
      (await readSavedConfig()).invitations.find((invitation) => invitation.id === createdInvitation!.id),
    ).toMatchObject({
      revokedAt: fixedNow,
      revokedBy: "user-owner",
    });
  });

  it("enforces invite permission and owner-only owner invites", async () => {
    await setRouteUser("user-viewer");

    const viewerResponse = await postInvitationsRoute(
      new Request("http://localhost/api/projects/project-1/member-invitations", {
        body: JSON.stringify({
          authorScopes: [],
          email: "blocked@example.com",
          roles: ["viewer"],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(viewerResponse.status).toBe(403);

    await setRouteUser("user-admin");

    const ownerInviteResponse = await postInvitationsRoute(
      new Request("http://localhost/api/projects/project-1/member-invitations", {
        body: JSON.stringify({
          authorScopes: [],
          email: "owner-invite@example.com",
          roles: ["owner"],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(ownerInviteResponse.status).toBe(403);
  });

  it("rejects duplicate pending invitations", async () => {
    const response = await postInvitationsRoute(
      new Request("http://localhost/api/projects/project-1/member-invitations", {
        body: JSON.stringify({
          authorScopes: [{ cmsAuthorId: "author-1", canPublish: true }],
          email: "Writer@Example.com",
          roles: ["author"],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ projectId: "project-1" }) },
    );

    expect(response.status).toBe(409);
  });
});
