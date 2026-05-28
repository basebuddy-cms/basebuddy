import { scrypt } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import {
  createDefaultBaseBuddyConfig,
  type BaseBuddyConfig,
} from "@/lib/basebuddy-config/schema";
import {
  createSignedBaseBuddySessionCookieValue,
  hashBaseBuddySessionToken,
} from "@/lib/basebuddy-config/auth";
import { getLocalAuthenticatedSessionFromCookieValue } from "@/lib/auth/local-auth";

const scryptAsync = promisify(scrypt);
const authSecret = "local-auth-secret-value-with-32-plus-chars";
const fixedNow = "2026-05-27T00:00:00.000Z";

const hashPasswordForTest = async (plainTextPassword: string, salt: string) =>
  ((await scryptAsync(plainTextPassword, salt, 64)) as Buffer).toString("base64url");

const createConfigWithSession = async ({
  expiresAt,
  token,
}: {
  expiresAt: string;
  token: string;
}) => {
  const passwordSalt = "owner-password-salt";
  const config = createDefaultBaseBuddyConfig({
    content: {
      provider: "postgres",
    },
    now: fixedNow,
  });

  config.users.push({
    avatarUrl: null,
    createdAt: fixedNow,
    email: "owner@example.com",
    id: "user_owner",
    name: "Owner User",
    passwordHash: await hashPasswordForTest("correct-password-123", passwordSalt),
    passwordHashParams: {
      keyLength: 64,
      name: "scrypt",
    },
    passwordSalt,
    updatedAt: fixedNow,
  });
  config.sessions.push({
    createdAt: fixedNow,
    expiresAt,
    id: "session_owner",
    lastSeenAt: fixedNow,
    tokenHash: hashBaseBuddySessionToken(token),
    userId: "user_owner",
  });

  await writeFile(getBaseBuddyConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
};

const readConfig = async () =>
  JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as BaseBuddyConfig;

describe("local config auth sessions", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-local-auth-session-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("rejects expired sessions and removes them from the config file", async () => {
    const token = "raw-session-token";
    await createConfigWithSession({
      expiresAt: "2026-05-26T00:00:00.000Z",
      token,
    });
    const cookieValue = createSignedBaseBuddySessionCookieValue({
      authSecret,
      token,
    });

    await expect(
      getLocalAuthenticatedSessionFromCookieValue(cookieValue, {
        now: () => new Date("2026-05-27T00:00:00.000Z"),
      }),
    ).resolves.toBeNull();

    await expect(readConfig()).resolves.toMatchObject({
      sessions: [],
    });
  });

  it("loads a valid signed session without exposing the raw token from config", async () => {
    const token = "raw-session-token";
    await createConfigWithSession({
      expiresAt: "2026-06-26T00:00:00.000Z",
      token,
    });
    const cookieValue = createSignedBaseBuddySessionCookieValue({
      authSecret,
      token,
    });

    const result = await getLocalAuthenticatedSessionFromCookieValue(cookieValue, {
      now: () => new Date("2026-05-27T00:00:00.000Z"),
    });
    const config = await readConfig();

    expect(result).toMatchObject({
      account: {
        email: "owner@example.com",
        name: "Owner User",
      },
      user: {
        id: "user_owner",
      },
    });
    expect(JSON.stringify(config)).not.toContain(token);
  });
});
