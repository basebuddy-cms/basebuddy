import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const {
  createClientMock,
  enforceRateLimitMock,
  enforceSameOriginRequestMock,
  ensureContentMappingDraftMock,
  invalidateControlPlaneRuntimeCacheMock,
  revalidatePathMock,
  requireAuthenticatedApiUserMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  enforceRateLimitMock: vi.fn(() => null),
  enforceSameOriginRequestMock: vi.fn(() => null),
  ensureContentMappingDraftMock: vi.fn(),
  invalidateControlPlaneRuntimeCacheMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireAuthenticatedApiUserMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/api/api-auth", () => ({
  requireAuthenticatedApiUser: requireAuthenticatedApiUserMock,
}));

vi.mock("@/lib/api/request-guards", () => ({
  enforceRateLimit: enforceRateLimitMock,
  enforceSameOriginRequest: enforceSameOriginRequestMock,
  parseJsonBody: vi.fn(async (request: Request) => ({
    data: await request.json(),
    errorResponse: null,
  })),
}));

vi.mock("@/lib/control-plane/server-runtime-cache", () => ({
  invalidateControlPlaneRuntimeCache: invalidateControlPlaneRuntimeCacheMock,
}));

vi.mock("@/lib/control-plane/server", () => ({}));

vi.mock("@/lib/content-runtime/server", () => ({
  ensureContentMappingDraft: ensureContentMappingDraftMock,
}));


import { POST as postCreateProjectRoute } from "@/app/api/projects/route";
import { GET as getProjectSlugAvailabilityRoute } from "@/app/api/projects/slug-availability/route";
import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";
import {
  ensureBaseBuddyConfig,
  loadBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "@/lib/basebuddy-config/store";
import { normalizeContentProjectMapping } from "@/lib/content-runtime/mapping";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("projects create route", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-project-create-route-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });

    requireAuthenticatedApiUserMock.mockResolvedValue({
      account: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Owner",
      },
      errorResponse: null,
      user: {
        id: "user-1",
      },
    });
    createClientMock.mockRejectedValue(new Error("Project routes must not use Supabase."));
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("creates a config-backed project and redirects to the normalized slug", async () => {
    const response = await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          projectName: " Demo Project ",
          projectSlug: "Demo Project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const body = await response.json();
    const config = await loadBaseBuddyConfig();
    const project = config.projects[0]!;
    const mapping = normalizeContentProjectMapping(project.mapping);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      redirectTo: "/projects/demo-project",
    });
    expect(project).toMatchObject({
      createdAt: fixedNow,
      createdBy: "user-1",
      name: "Demo Project",
      slug: "demo-project",
      status: "active",
      updatedAt: fixedNow,
      websiteUrl: null,
    });
    expect(project.members).toEqual([
      {
        allowPermissionKeys: [],
        authorScopes: [],
        denyPermissionKeys: [],
        joinedAt: fixedNow,
        roles: ["owner"],
        userId: "user-1",
      },
    ]);
    expect(mapping).toMatchObject({
      bindingId: project.id,
      bindingMode: "mapped_content",
      bindingStatus: "draft",
      revisionVersion: 1,
    });
    expect(project.mappingRevisions).toHaveLength(1);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(ensureContentMappingDraftMock).not.toHaveBeenCalled();
    expect(invalidateControlPlaneRuntimeCacheMock).toHaveBeenCalledWith({
      groups: ["project-bootstrap", "projects-list"],
      userId: "user-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects");
    expect(getBaseBuddyConfigPath()).toBe(join(process.cwd(), "basebuddy.config.json"));
  });

  it("ignores hosted-era project fields and stores only the config project record", async () => {
    const response = await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          accessMode: "direct_connection",
          databasePassword: "secret",
          projectName: "Demo Project",
          projectRef: "demo-ref",
          projectSlug: "demo-project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const config = await loadBaseBuddyConfig();

    expect(response.status).toBe(200);
    expect(config.projects).toHaveLength(1);
    expect(JSON.stringify(config.projects[0])).not.toContain("databasePassword");
    expect(JSON.stringify(config.projects[0])).not.toContain("projectRef");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a conflict when the normalized slug already exists in config", async () => {
    await writeBaseBuddyConfig((config) => ({
      ...config,
      projects: [
        {
          createdAt: fixedNow,
          createdBy: "user-1",
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
              userId: "user-1",
            },
          ],
          name: "Existing Project",
          sidebar: null,
          sidebarRevisions: [],
          slug: "existing-project",
          status: "active",
          updatedAt: fixedNow,
          websiteUrl: null,
        },
      ],
    }));

    const response = await postCreateProjectRoute(
      new Request("http://localhost/api/projects", {
        body: JSON.stringify({
          projectName: "Duplicate Project",
          projectSlug: "Existing Project",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const body = await response.json();
    const config = await loadBaseBuddyConfig();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "That project address is already taken. Choose another address and try again.",
    });
    expect(config.projects).toHaveLength(1);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("checks slug availability from config", async () => {
    await writeBaseBuddyConfig((config) => ({
      ...config,
      projects: [
        ...config.projects,
        {
          createdAt: fixedNow,
          createdBy: "user-1",
          id: "project-1",
          mapping: null,
          mappingRevisions: [],
          members: [],
          name: "Existing Project",
          sidebar: null,
          sidebarRevisions: [],
          slug: "existing-project",
          status: "active",
          updatedAt: fixedNow,
          websiteUrl: null,
        },
      ],
    }));

    const takenResponse = await getProjectSlugAvailabilityRoute(
      new Request("http://localhost/api/projects/slug-availability?slug=Existing Project"),
    );
    const availableResponse = await getProjectSlugAvailabilityRoute(
      new Request("http://localhost/api/projects/slug-availability?slug=Fresh Project"),
    );

    await expect(takenResponse.json()).resolves.toEqual({
      available: false,
      normalizedSlug: "existing-project",
    });
    await expect(availableResponse.json()).resolves.toEqual({
      available: true,
      normalizedSlug: "fresh-project",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("keeps the same invalid slug response shape", async () => {
    const response = await getProjectSlugAvailabilityRoute(
      new Request("http://localhost/api/projects/slug-availability?slug=!!!"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      available: false,
      normalizedSlug: "",
      reason: "Enter a project address first.",
    });
  });

  it("creates valid default config in the test root before exercising routes", async () => {
    await expect(loadBaseBuddyConfig()).resolves.toEqual(
      createDefaultBaseBuddyConfig({
        now: fixedNow,
      }),
    );
  });
});
