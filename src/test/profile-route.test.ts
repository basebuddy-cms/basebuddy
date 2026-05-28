import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  createClientMock,
  invalidateControlPlaneRuntimeCacheMock,
  revalidatePathMock,
  requireAuthenticatedApiUserMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
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

vi.mock("@/lib/control-plane/server-runtime-cache", () => ({
  invalidateControlPlaneRuntimeCache: invalidateControlPlaneRuntimeCacheMock,
}));


import { PATCH as patchProfileRoute } from "@/app/api/profile/route";
import {
  ensureBaseBuddyConfig,
  loadBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "@/lib/basebuddy-config/store";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("profile route", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-profile-route-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
    vi.clearAllMocks();

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      users: [
        {
          avatarUrl: "https://cdn.example.com/owner.png",
          createdAt: fixedNow,
          email: "owner@example.com",
          id: "user-1",
          name: "Owner",
          passwordHash: "password-hash",
          passwordHashParams: {
            keyLength: 64,
            name: "scrypt",
          },
          passwordSalt: "password-salt",
          updatedAt: fixedNow,
        },
      ],
    }));

    requireAuthenticatedApiUserMock.mockResolvedValue({
      errorResponse: null,
      user: {
        avatarUrl: "https://cdn.example.com/owner.png",
        email: "owner@example.com",
        id: "user-1",
        name: "Owner",
      },
    });
    createClientMock.mockRejectedValue(new Error("Profile route must not use Supabase."));
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("updates the local config profile without touching Supabase profile tables or avatar storage", async () => {
    const response = await patchProfileRoute(
      new Request("http://localhost/api/profile", {
        body: JSON.stringify({
          avatarUrl: null,
          name: "Updated Owner",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      }),
    );
    const body = await response.json();
    const config = await loadBaseBuddyConfig();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      profile: {
        avatarUrl: null,
        email: "owner@example.com",
        name: "Updated Owner",
      },
    });
    expect(config.users[0]).toMatchObject({
      avatarUrl: null,
      email: "owner@example.com",
      id: "user-1",
      name: "Updated Owner",
      passwordHash: "password-hash",
      passwordSalt: "password-salt",
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(invalidateControlPlaneRuntimeCacheMock).toHaveBeenCalledWith({
      groups: ["profile-bootstrap"],
      userId: "user-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/profile");
  });
});
