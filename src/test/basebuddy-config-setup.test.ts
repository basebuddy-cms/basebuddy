import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";
import { ensureBaseBuddyConfig, writeBaseBuddyConfig } from "@/lib/basebuddy-config/store";
import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";
const databaseUrl = "postgresql://content-user:db-pass@example.com:5432/postgres";

describe("BaseBuddy config setup status", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-config-setup-"));
    process.chdir(tempDir);
    await mkdir(join(process.cwd(), "basebuddy-data"), { recursive: true });
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("treats a missing basebuddy-data config as setup-required without crashing", async () => {
    const status = await getBaseBuddyConfigSetupStatus();
    const configSection = status.sections.find((section) => section.title === "Config file");

    expect(isBaseBuddyConfigSetupReady(status)).toBe(false);
    expect(status.topology).toBe("config-file");
    expect(JSON.stringify(status)).not.toMatch(/same-project|split-project|unified|split/i);
    expect(status.configPath).toBe(
      join(process.cwd(), "basebuddy-data", "basebuddy.config.json"),
    );
    expect(configSection?.status).toBe("missing");
    expect(configSection?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "basebuddy.config.exists",
          status: "missing",
        }),
        expect.objectContaining({
          key: "basebuddy.config.writable",
          status: "ready",
        }),
        expect.objectContaining({
          key: "basebuddy.config.valid",
          status: "missing",
        }),
      ]),
    );
  });

  it("reports invalid config files as setup errors with clear diagnostics", async () => {
    await writeFile(getBaseBuddyConfigPath(), "{not-json", "utf8");

    const status = await getBaseBuddyConfigSetupStatus();
    const configSection = status.sections.find((section) => section.title === "Config file");

    expect(isBaseBuddyConfigSetupReady(status)).toBe(false);
    expect(configSection?.status).toBe("invalid");
    expect(JSON.stringify(status)).toContain("Could not parse BaseBuddy config file");
  });

  it("requires an owner account and database connection after the config validates", async () => {
    await ensureBaseBuddyConfig({
      now: fixedNow,
    });

    const status = await getBaseBuddyConfigSetupStatus();

    expect(isBaseBuddyConfigSetupReady(status)).toBe(false);
    expect(status.sections.find((section) => section.title === "Owner account")?.status).toBe(
      "missing",
    );
    expect(status.sections.find((section) => section.title === "Environment values")?.status).toBe(
      "missing",
    );
    expect(status.sections.find((section) => section.title === "Database connection")?.status).toBe(
      "missing",
    );
  });

  it("reports a missing separate Supabase app-data database without creating local config paths", async () => {
    vi.stubEnv("BASEBUDDY_APP_STATE_BACKEND", "supabase-split-project");
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);

    const status = await getBaseBuddyConfigSetupStatus();
    const configSection = status.sections.find((section) => section.title === "BaseBuddy app data");

    expect(isBaseBuddyConfigSetupReady(status)).toBe(false);
    expect(status.topology).toBe("supabase-split-project");
    expect(status.configPath).toBe("supabase separate project: basebuddy.app_state");
    expect(configSection?.status).toBe("missing");
    expect(JSON.stringify(status)).toContain("BASEBUDDY_APP_STATE_DATABASE_URL");
    expect(JSON.stringify(status)).not.toContain(join(process.cwd(), "basebuddy-data"));
  });

  it("marks setup ready when the config has an owner and env has auth/database credentials", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      users: [
        {
          avatarUrl: null,
          createdAt: fixedNow,
          email: "owner@example.com",
          id: "user_owner",
          name: "Owner",
          passwordHash: "owner-password-hash",
          passwordHashParams: {
            keyLength: 64,
            name: "scrypt",
          },
          passwordSalt: "owner-password-salt",
          updatedAt: fixedNow,
        },
      ],
    }));
    const queryDatabase = vi.fn().mockResolvedValue(undefined);

    const status = await getBaseBuddyConfigSetupStatus({
      checkContentDatabase: true,
      queryDatabase,
    });
    const serialized = JSON.stringify(status);

    expect(isBaseBuddyConfigSetupReady(status)).toBe(true);
    expect(queryDatabase).toHaveBeenCalledWith(databaseUrl);
    expect(serialized).not.toContain(authSecret);
    expect(serialized).not.toContain("db-pass");
    expect(serialized).not.toContain("example.com");
    expect(serialized).not.toContain("owner-password-hash");
    expect(serialized).not.toContain("owner-password-salt");
    expect(serialized).toContain("set:");
  });

  it("recommends a restricted database role instead of the broad postgres owner", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv(
      "BASEBUDDY_CONTENT_DATABASE_URL",
      "postgresql://postgres:db-pass@example.com:5432/postgres",
    );

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    const status = await getBaseBuddyConfigSetupStatus();
    const roleSection = status.sections.find((section) => section.title === "Database role");

    expect(roleSection?.status).toBe("invalid");
    expect(roleSection?.checks[0]).toMatchObject({
      required: false,
      status: "invalid",
    });
    expect(roleSection?.checks[0]?.value).toContain("restricted database role");
  });

  it("reads setup env values from .env.local in the current working directory", async () => {
    await writeFile(
      join(tempDir, ".env.local"),
      [
        `BASEBUDDY_AUTH_SECRET=${authSecret}`,
        `BASEBUDDY_CONTENT_DATABASE_URL=${databaseUrl}`,
        "",
      ].join("\n"),
      "utf8",
    );
    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      users: [
        {
          avatarUrl: null,
          createdAt: fixedNow,
          email: "owner@example.com",
          id: "user_owner",
          name: "Owner",
          passwordHash: "owner-password-hash",
          passwordHashParams: {
            keyLength: 64,
            name: "scrypt",
          },
          passwordSalt: "owner-password-salt",
          updatedAt: fixedNow,
        },
      ],
    }));
    const queryDatabase = vi.fn().mockResolvedValue(undefined);

    const status = await getBaseBuddyConfigSetupStatus({
      checkContentDatabase: true,
      queryDatabase,
    });

    expect(isBaseBuddyConfigSetupReady(status)).toBe(true);
    expect(queryDatabase).toHaveBeenCalledWith(databaseUrl);
    expect(JSON.stringify(status)).not.toContain(authSecret);
    expect(JSON.stringify(status)).not.toContain("db-pass");
    expect(JSON.stringify(status)).not.toContain("example.com");
  });

  it("lets process env override local env files for production and test runners", async () => {
    const fileDatabaseUrl = "postgresql://file-user:file-pass@example.com:5432/postgres";
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);
    await writeFile(
      join(tempDir, ".env"),
      [
        "BASEBUDDY_AUTH_SECRET=file-auth-secret-value-with-32-plus-chars",
        `BASEBUDDY_CONTENT_DATABASE_URL=${fileDatabaseUrl}`,
        "",
      ].join("\n"),
      "utf8",
    );
    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      users: [
        {
          avatarUrl: null,
          createdAt: fixedNow,
          email: "owner@example.com",
          id: "user_owner",
          name: "Owner",
          passwordHash: "owner-password-hash",
          passwordHashParams: {
            keyLength: 64,
            name: "scrypt",
          },
          passwordSalt: "owner-password-salt",
          updatedAt: fixedNow,
        },
      ],
    }));
    const queryDatabase = vi.fn().mockResolvedValue(undefined);

    const status = await getBaseBuddyConfigSetupStatus({
      checkContentDatabase: true,
      queryDatabase,
    });

    expect(isBaseBuddyConfigSetupReady(status)).toBe(true);
    expect(queryDatabase).toHaveBeenCalledWith(databaseUrl);
    expect(queryDatabase).not.toHaveBeenCalledWith(fileDatabaseUrl);
  });

  it("reports image and file storage credentials from env without exposing secrets", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);
    vi.stubEnv("BASEBUDDY_SUPABASE_PUBLISHABLE_KEY", "storage-publishable-key");
    vi.stubEnv("BASEBUDDY_SUPABASE_SECRET_KEY", "storage-service-role-secret");
    vi.stubEnv("BASEBUDDY_SUPABASE_URL", "https://storage.supabase.co");
    vi.stubEnv("BASEBUDDY_S3_ACCESS_KEY_ID", "s3-access-key");
    vi.stubEnv("BASEBUDDY_S3_SECRET_ACCESS_KEY", "s3-secret-key");

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      users: [
        {
          avatarUrl: null,
          createdAt: fixedNow,
          email: "owner@example.com",
          id: "user_owner",
          name: "Owner",
          passwordHash: "owner-password-hash",
          passwordHashParams: {
            keyLength: 64,
            name: "scrypt",
          },
          passwordSalt: "owner-password-salt",
          updatedAt: fixedNow,
        },
      ],
    }));

    const status = await getBaseBuddyConfigSetupStatus();
    const supabaseStorageSection = status.sections.find(
      (section) => section.title === "Supabase storage",
    );
    const s3StorageSection = status.sections.find(
      (section) => section.title === "S3-compatible storage",
    );
    const serialized = JSON.stringify(status);

    expect(supabaseStorageSection?.status).toBe("ready");
    expect(s3StorageSection?.status).toBe("ready");
    expect(serialized).not.toContain("storage-service-role-secret");
    expect(serialized).not.toContain("s3-secret-key");
    expect(serialized).not.toContain("db-pass");
    expect(serialized).toContain("set:");
  });

  it("does not block setup readiness when optional media storage is incomplete", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);
    vi.stubEnv("BASEBUDDY_SUPABASE_URL", "https://storage.supabase.co");

    await ensureBaseBuddyConfig({
      now: fixedNow,
    });
    await writeBaseBuddyConfig((config) => ({
      ...config,
      users: [
        {
          avatarUrl: null,
          createdAt: fixedNow,
          email: "owner@example.com",
          id: "user_owner",
          name: "Owner",
          passwordHash: "owner-password-hash",
          passwordHashParams: {
            keyLength: 64,
            name: "scrypt",
          },
          passwordSalt: "owner-password-salt",
          updatedAt: fixedNow,
        },
      ],
    }));

    const status = await getBaseBuddyConfigSetupStatus({
      checkContentDatabase: true,
      queryDatabase: vi.fn().mockResolvedValue(undefined),
    });

    expect(status.sections.find((section) => section.title === "Supabase storage")?.status).toBe(
      "invalid",
    );
    expect(isBaseBuddyConfigSetupReady(status)).toBe(true);
  });

  it("marks setup invalid when the configured database cannot be reached", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);

    await writeFile(
      getBaseBuddyConfigPath(),
      JSON.stringify(
        {
          ...createDefaultBaseBuddyConfig({
            now: fixedNow,
          }),
          users: [
            {
              avatarUrl: null,
              createdAt: fixedNow,
              email: "owner@example.com",
              id: "user_owner",
              name: "Owner",
              passwordHash: "owner-password-hash",
              passwordHashParams: {
                keyLength: 64,
                name: "scrypt",
              },
              passwordSalt: "owner-password-salt",
              updatedAt: fixedNow,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const status = await getBaseBuddyConfigSetupStatus({
      checkContentDatabase: true,
      queryDatabase: vi.fn().mockRejectedValue(new Error("password authentication failed")),
    });

    expect(isBaseBuddyConfigSetupReady(status)).toBe(false);
    expect(status.sections.find((section) => section.title === "Database connection")?.status).toBe(
      "invalid",
    );
    expect(JSON.stringify(status)).not.toContain("password authentication failed");
  });
});
