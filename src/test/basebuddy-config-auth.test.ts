import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createBaseBuddyConfigUser,
  updateBaseBuddyConfigUserProfile,
} from "@/lib/basebuddy-config/auth";
import {
  ensureBaseBuddyConfig,
  loadBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "@/lib/basebuddy-config/store";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

const readAuditEvents = async (tempDir: string) => {
  const contents = await readFile(join(tempDir, "basebuddy.audit.jsonl"), "utf8");

  return contents.trim().split("\n").map((line) => JSON.parse(line));
};

describe("BaseBuddy config auth profile helpers", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-config-auth-"));
    process.chdir(tempDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      sessions: [
        {
          createdAt: fixedNow,
          expiresAt: "2026-06-27T00:00:00.000Z",
          id: "session-1",
          lastSeenAt: fixedNow,
          tokenHash: "session-token-hash",
          userId: "user-1",
        },
      ],
      users: [
        {
          avatarUrl: "https://cdn.example.com/old-avatar.png",
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
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("updates only config-backed profile metadata for the target user", async () => {
    const updatedUser = await updateBaseBuddyConfigUserProfile({
      avatarUrl: null,
      name: " Updated Owner ",
      userId: "user-1",
    });
    const config = await loadBaseBuddyConfig();

    expect(updatedUser).toEqual({
      avatarUrl: null,
      email: "owner@example.com",
      id: "user-1",
      name: "Updated Owner",
    });
    expect(config.users).toEqual([
      expect.objectContaining({
        avatarUrl: null,
        createdAt: fixedNow,
        email: "owner@example.com",
        id: "user-1",
        name: "Updated Owner",
        passwordHash: "password-hash",
        passwordHashParams: {
          keyLength: 64,
          name: "scrypt",
        },
        passwordSalt: "password-salt",
        updatedAt: fixedNow,
      }),
    ]);
    expect(config.sessions).toEqual([
      expect.objectContaining({
        id: "session-1",
        tokenHash: "session-token-hash",
        userId: "user-1",
      }),
    ]);

    const auditEvents = await readAuditEvents(tempDir);

    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorUserId: "user-1",
        targetUserId: "user-1",
        type: "user.profile.update",
      }),
    ]);
  });

  it("writes user creation events to the separate audit log", async () => {
    const createdUser = await createBaseBuddyConfigUser({
      email: "second-owner@example.com",
      name: "Second Owner",
      password: "SecondPass1!",
    });
    const config = await loadBaseBuddyConfig();
    const auditEvents = await readAuditEvents(tempDir);

    expect(createdUser).toMatchObject({
      email: "second-owner@example.com",
      name: "Second Owner",
    });
    expect(config.users).toHaveLength(2);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorEmail: "second-owner@example.com",
        targetUserId: createdUser?.id,
        type: "user.create",
      }),
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain("SecondPass1!");
  });
});
