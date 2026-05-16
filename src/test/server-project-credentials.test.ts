import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => {
    const memoized = new Map<string, Promise<unknown>>();

    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);

      if (!memoized.has(key)) {
        memoized.set(key, fn(...args));
      }

      return memoized.get(key) as ReturnType<T>;
    }) as unknown as T;
  },
}));

const {
  createAdminClientMock,
  createSupabaseServerClientMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createSupabaseServerClientMock: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createSupabaseServerClientMock,
}));

describe("server project credentials", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY: "control-secret-key",
      BASEBUDDY_CONTROL_SUPABASE_URL: "https://install.supabase.co",
      BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY: "control-secret-key",
      BASEBUDDY_CONTENT_SUPABASE_URL: "https://install.supabase.co",
    };
    delete process.env.BASEBUDDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.BASEBUDDY_S3_ACCESS_KEY_ID;
    delete process.env.BASEBUDDY_S3_SECRET_ACCESS_KEY;
    delete process.env.BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID;
    delete process.env.BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY;
    delete process.env.BASEBUDDY_FILES_S3_ACCESS_KEY_ID;
    delete process.env.BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    createAdminClientMock.mockReset();
    createSupabaseServerClientMock.mockReset();
  });

  it("reads the Supabase storage secret key from env without project secret RPCs", async () => {
    const { getContentStorageServiceKey } = await import(
      "@/lib/content-runtime/server-project-credentials"
    );

    await expect(getContentStorageServiceKey("project-1")).resolves.toBe("control-secret-key");
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("uses the content-plane secret key for mapped storage access", async () => {
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "content-secret-key";

    const { getContentStorageServiceKey } = await import(
      "@/lib/content-runtime/server-project-credentials"
    );

    await expect(getContentStorageServiceKey("project-1")).resolves.toBe("content-secret-key");
  });

  it("rejects the legacy content-plane service role env fallback", async () => {
    delete process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY;
    process.env.BASEBUDDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY = "content-service-role-key";

    const { getContentStorageServiceKey } = await import(
      "@/lib/content-runtime/server-project-credentials"
    );

    await expect(getContentStorageServiceKey("project-1")).rejects.toThrow(
      "Missing required environment variable: BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY",
    );
  });

  it("reports missing S3 media credentials from env without checking stored project secrets", async () => {
    const {
      getContentMediaStorageCredentialStatus,
      getContentS3CompatibleMediaCredentials,
    } = await import("@/lib/content-runtime/server-project-credentials");

    await expect(getContentS3CompatibleMediaCredentials("project-1")).resolves.toBeNull();
    await expect(getContentMediaStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: false,
      hasS3SecretAccessKey: false,
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("uses env-backed S3 media credentials before checking stored project secrets", async () => {
    process.env.BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID = "media-access-key";
    process.env.BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY = "media-secret-key";

    const {
      getContentMediaStorageCredentialStatus,
      getContentS3CompatibleMediaCredentials,
    } = await import("@/lib/content-runtime/server-project-credentials");

    await expect(getContentS3CompatibleMediaCredentials("project-1")).resolves.toEqual({
      accessKeyId: "media-access-key",
      secretAccessKey: "media-secret-key",
    });
    await expect(getContentMediaStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: true,
      hasS3SecretAccessKey: true,
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("uses env-backed S3 files credentials before checking stored project secrets", async () => {
    process.env.BASEBUDDY_FILES_S3_ACCESS_KEY_ID = "files-access-key";
    process.env.BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY = "files-secret-key";

    const {
      getContentFilesStorageCredentialStatus,
      getContentS3CompatibleFilesCredentials,
    } = await import("@/lib/content-runtime/server-project-credentials");

    await expect(getContentS3CompatibleFilesCredentials("project-1")).resolves.toEqual({
      accessKeyId: "files-access-key",
      secretAccessKey: "files-secret-key",
    });
    await expect(getContentFilesStorageCredentialStatus("project-1")).resolves.toEqual({
      hasS3AccessKeyId: true,
      hasS3SecretAccessKey: true,
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });
});
