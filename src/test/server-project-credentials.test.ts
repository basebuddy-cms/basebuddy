import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  createAdminClientMock,
  createSupabaseServerClientMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createSupabaseServerClientMock: vi.fn(),
}));



import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";

const fixedNow = "2026-05-28T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";

describe("server project credentials", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-project-credentials-"));
    process.chdir(tempDir);
    vi.resetModules();
    vi.unstubAllEnvs();
    createAdminClientMock.mockReset();
    createSupabaseServerClientMock.mockReset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  const writeConfig = async ({
  } = {}) => {
    const config = createDefaultBaseBuddyConfig({
      content: {
        provider: "postgres",
      },
      now: fixedNow,
    });

    await writeFile(getBaseBuddyConfigPath(), JSON.stringify(config, null, 2), "utf8");
    return config;
  };

  it("reads the Supabase storage secret key from env", async () => {
    await writeConfig();
    vi.stubEnv("BASEBUDDY_SUPABASE_SECRET_KEY", "env-storage-secret-key");

    const { getContentStorageServiceKey } = await import(
      "@/lib/content-runtime/server-project-credentials"
    );

    await expect(getContentStorageServiceKey("project-1")).resolves.toBe(
      "env-storage-secret-key",
    );
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("treats the Supabase storage secret as optional when env does not include it", async () => {
    await writeConfig();

    const { getContentStorageServiceKey } = await import(
      "@/lib/content-runtime/server-project-credentials"
    );

    await expect(getContentStorageServiceKey("project-1")).resolves.toBeNull();
  });

  it("reads shared S3-compatible credentials from env for media and files", async () => {
    await writeConfig();
    vi.stubEnv("BASEBUDDY_S3_ACCESS_KEY_ID", "env-s3-access-key");
    vi.stubEnv("BASEBUDDY_S3_SECRET_ACCESS_KEY", "env-s3-secret-key");

    const {
      getContentFilesStorageCredentialStatus,
      getContentMediaStorageCredentialStatus,
      getContentS3CompatibleFilesCredentials,
      getContentS3CompatibleMediaCredentials,
    } = await import("@/lib/content-runtime/server-project-credentials");

    await expect(getContentS3CompatibleMediaCredentials("project-1")).resolves.toEqual({
      accessKeyId: "env-s3-access-key",
      secretAccessKey: "env-s3-secret-key",
    });
    await expect(getContentS3CompatibleFilesCredentials("project-1")).resolves.toEqual({
      accessKeyId: "env-s3-access-key",
      secretAccessKey: "env-s3-secret-key",
    });
    await expect(getContentMediaStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: true,
      hasS3SecretAccessKey: true,
    });
    await expect(getContentFilesStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: true,
      hasS3SecretAccessKey: true,
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("reports missing S3-compatible credentials when config does not include them", async () => {
    await writeConfig();

    const {
      getContentFilesStorageCredentialStatus,
      getContentMediaStorageCredentialStatus,
      getContentS3CompatibleFilesCredentials,
      getContentS3CompatibleMediaCredentials,
    } = await import("@/lib/content-runtime/server-project-credentials");

    await expect(getContentS3CompatibleMediaCredentials("project-1")).resolves.toBeNull();
    await expect(getContentS3CompatibleFilesCredentials("project-1")).resolves.toBeNull();
    await expect(getContentMediaStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    });
    await expect(getContentFilesStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    });
  });
});
