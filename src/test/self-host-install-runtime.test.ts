import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ORIGINAL_ENV = { ...process.env };

describe("self-host install runtime env", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY: "control-secret-key",
    };
    delete process.env.BASEBUDDY_CONTROL_DATABASE_URL;
    delete process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY;
    delete process.env.BASEBUDDY_CONTROL_SUPABASE_URL;
    delete process.env.BASEBUDDY_DATABASE_URL;
    delete process.env.BASEBUDDY_CONTENT_DATABASE_URL;
    delete process.env.BASEBUDDY_CONTENT_POSTGRES_URL;
    delete process.env.BASEBUDDY_CONTENT_SUPABASE_DATABASE_URL;
    delete process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY;
    delete process.env.BASEBUDDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.BASEBUDDY_CONTENT_SUPABASE_URL;
    delete process.env.BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE;
    delete process.env.BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE_FILE;
    delete process.env.BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE;
    delete process.env.BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE_FILE;
    delete process.env.BASEBUDDY_RUNTIME_TOPOLOGY;
    delete process.env.BASEBUDDY_AUTH_PROVIDERS;
    delete process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.BASEBUDDY_SUPABASE_SECRET_KEY;
    delete process.env.BASEBUDDY_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_BASEBUDDY_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_BASEBUDDY_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_BASEBUDDY_CONTENT_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.SUPABASE_DATABASE_URL;
    delete process.env.PROJECT_SECRETS_ENCRYPTION_KEY;
    delete process.env.BASEBUDDY_S3_ACCESS_KEY_ID;
    delete process.env.BASEBUDDY_S3_SECRET_ACCESS_KEY;
    delete process.env.BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID;
    delete process.env.BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY;
    delete process.env.BASEBUDDY_FILES_S3_ACCESS_KEY_ID;
    delete process.env.BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses same-project shorthand env as both the workspace and content connection", async () => {
    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_SUPABASE_SECRET_KEY = "same-project-secret-key";
    process.env.BASEBUDDY_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";

    const {
      getInstallControlPlaneDatabaseUrl,
      getInstallRuntimeContext,
      getInstallRuntimeTopology,
      getInstallContentSupabaseServiceRoleKey,
      validateInstallRuntimeConfiguration,
    } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).not.toThrow();
    expect(getInstallRuntimeTopology()).toBe("unified");
    expect(getInstallControlPlaneDatabaseUrl()).toBe(
      "postgresql://postgres:secret@db.local:5432/postgres",
    );
    expect(getInstallRuntimeContext()).toMatchObject({
      apiUrl: "https://demo.supabase.co",
      databaseUrl: "postgresql://postgres:secret@db.local:5432/postgres",
      publishableKey: "sb_publishable_test",
    });
    expect(getInstallContentSupabaseServiceRoleKey()).toBe("same-project-secret-key");
  });

  it("detects missing, same-project, split-project, and mixed install env modes", async () => {
    const { getInstallEnvMode } = await import("@/lib/self-host/install-env");

    expect(getInstallEnvMode()).toBe("missing");

    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_SUPABASE_SECRET_KEY = "same-project-secret-key";
    process.env.BASEBUDDY_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";

    expect(getInstallEnvMode()).toBe("same-project");

    delete process.env.BASEBUDDY_SUPABASE_URL;
    delete process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.BASEBUDDY_SUPABASE_SECRET_KEY;
    delete process.env.BASEBUDDY_DATABASE_URL;
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_control";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://control-user:secret@control.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://content.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_content";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "content-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://content-user:secret@content.local:5432/postgres";

    expect(getInstallEnvMode()).toBe("split-project");

    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";

    expect(getInstallEnvMode()).toBe("mixed");
  });

  it("rejects mixed same-project and split-project install env", async () => {
    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_SUPABASE_SECRET_KEY = "same-project-secret-key";
    process.env.BASEBUDDY_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Use either the same-project env names or the split-project env names, not both.",
    );
  });

  it("parses configured login providers from env", async () => {
    process.env.BASEBUDDY_AUTH_PROVIDERS = "magic_link, google, github";

    const { getInstallAuthProviders } = await import("@/lib/self-host/auth-providers");

    expect(getInstallAuthProviders()).toEqual(["magic_link", "google", "github"]);
  });

  it("rejects unknown login provider env values", async () => {
    process.env.BASEBUDDY_AUTH_PROVIDERS = "magic_link, twitter";

    const { getInstallAuthProviders } = await import("@/lib/self-host/auth-providers");

    expect(() => getInstallAuthProviders()).toThrow(
      "BASEBUDDY_AUTH_PROVIDERS includes unsupported sign-in methods: twitter.",
    );
  });

  it("shows same-project setup diagnostics without split-project env noise", async () => {
    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_SUPABASE_SECRET_KEY = "same-project-secret-key";
    process.env.BASEBUDDY_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";

    const { getInstallSetupStatus } = await import("@/lib/self-host/install-runtime");

    const status = getInstallSetupStatus();
    const serialized = JSON.stringify(status);

    expect(status.topology).toBe("unified");
    expect(status.sections.find((section) => section.title === "App configuration")?.status).toBe(
      "ready",
    );
    expect(serialized).toContain("BASEBUDDY_SUPABASE_URL");
    expect(serialized).toContain("BASEBUDDY_DATABASE_URL");
    expect(serialized).not.toContain("BASEBUDDY_CONTROL_SUPABASE_URL");
    expect(serialized).not.toContain("BASEBUDDY_CONTENT_SUPABASE_URL");
    expect(serialized).not.toContain("same-project-secret-key");
    expect(serialized).toContain("postgresql://user:password@db.local:5432/postgres");
  });

  it("includes configured sign-in methods in setup diagnostics", async () => {
    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_SUPABASE_SECRET_KEY = "same-project-secret-key";
    process.env.BASEBUDDY_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_AUTH_PROVIDERS = "magic_link,google";

    const { getInstallSetupStatus } = await import("@/lib/self-host/install-runtime");

    const signInSection = getInstallSetupStatus().sections.find(
      (section) => section.title === "Sign-in",
    );

    expect(signInSection).toEqual(
      expect.objectContaining({
        status: "ready",
      }),
    );
    expect(signInSection?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "BASEBUDDY_AUTH_PROVIDERS",
          label: "Enabled sign-in methods",
          status: "ready",
          value: "magic_link, google",
        }),
      ]),
    );
  });

  it("marks setup diagnostics invalid when sign-in methods are unsupported", async () => {
    process.env.BASEBUDDY_AUTH_PROVIDERS = "magic_link,twitter";

    const { getInstallSetupStatus } = await import("@/lib/self-host/install-runtime");

    const signInSection = getInstallSetupStatus().sections.find(
      (section) => section.title === "Sign-in",
    );

    expect(signInSection).toEqual(
      expect.objectContaining({
        status: "invalid",
      }),
    );
    expect(signInSection?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "BASEBUDDY_AUTH_PROVIDERS",
          status: "invalid",
          value: "unsupported sign-in method",
        }),
      ]),
    );
  });

  it("uses one Supabase project as both control and content planes when both sections match", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";

    const {
      getInstallRuntimeContext,
      getInstallRuntimeTopology,
      getInstallContentSupabaseServiceRoleKey,
      validateInstallRuntimeConfiguration,
    } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).not.toThrow();
    expect(getInstallRuntimeTopology()).toBe("unified");
    expect(getInstallRuntimeContext()).toMatchObject({
      apiUrl: "https://demo.supabase.co",
      databaseUrl: "postgresql://postgres:secret@db.local:5432/postgres",
      publishableKey: "sb_publishable_test",
    });
    expect(getInstallContentSupabaseServiceRoleKey()).toBe("control-secret-key");
  });

  it("uses a separate content plane when the content envs differ from control envs", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_control";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://control-user:secret@control.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://content.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_content";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "content-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://content-user:secret@content.local:5432/postgres";

    const {
      getInstallControlPlaneDatabaseUrl,
      getInstallRuntimeContext,
      getInstallRuntimeTopology,
      getInstallContentSupabaseServiceRoleKey,
      validateInstallRuntimeConfiguration,
    } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).not.toThrow();
    expect(getInstallRuntimeTopology()).toBe("split");
    expect(getInstallControlPlaneDatabaseUrl()).toBe(
      "postgresql://control-user:secret@control.local:5432/postgres",
    );
    expect(getInstallRuntimeContext()).toMatchObject({
      apiUrl: "https://content.supabase.co",
      databaseUrl: "postgresql://content-user:secret@content.local:5432/postgres",
      publishableKey: "sb_publishable_content",
    });
    expect(getInstallContentSupabaseServiceRoleKey()).toBe("content-secret-key");
  });

  it("rejects legacy control-plane env names instead of treating them as install config", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-key";
    process.env.DATABASE_URL = "postgresql://postgres:secret@db.local:5432/postgres";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Missing required environment variable: BASEBUDDY_CONTROL_SUPABASE_URL",
    );
  });

  it("ignores example placeholders without falling back to legacy runtime env names", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://your-control-project-ref.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_xxxxxxxxxxxxxxxxxxxx";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "your-control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://postgres:your-password@db.your-control-project-ref.supabase.co:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://your-content-project-ref.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_xxxxxxxxxxxxxxxxxxxx";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "your-content-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:your-password@db.your-content-project-ref.supabase.co:5432/postgres";
    process.env.NEXT_PUBLIC_BASEBUDDY_SUPABASE_URL = "https://real.supabase.co";
    process.env.NEXT_PUBLIC_BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_real";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-key";
    process.env.DATABASE_URL = "postgresql://postgres:secret@db.local:5432/postgres";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Missing required environment variable: BASEBUDDY_CONTROL_SUPABASE_URL",
    );
  });

  it("rejects POSTGRES_URL as a compatibility fallback", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-key";
    process.env.POSTGRES_URL = "postgresql://postgres:secret@db.local:5432/postgres";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Missing required environment variable: BASEBUDDY_CONTROL_SUPABASE_URL",
    );
  });

  it("uses relaxed TLS verification when no session pooler root certificate is configured", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";

    const { getInstallDatabaseSslConfig } = await import("@/lib/self-host/install-runtime");

    expect(getInstallDatabaseSslConfig()).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("disables TLS when the content database URL explicitly sets sslmode=disable", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_control";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://control-user:secret@control.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "http://127.0.0.1:56321";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_content";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "content-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable";

    const { getInstallDatabaseSslConfig } = await import("@/lib/self-host/install-runtime");

    expect(getInstallDatabaseSslConfig()).toBe(false);
  });

  it("does not let sslmode=disable bypass an explicit session pooler root certificate", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_control";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://control-user:secret@control.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "http://127.0.0.1:56321";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_content";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "content-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable";
    process.env.BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\\ncontent-cert\\n-----END CERTIFICATE-----";

    const { getInstallDatabaseSslConfig } = await import("@/lib/self-host/install-runtime");

    expect(getInstallDatabaseSslConfig()).toEqual({
      ca: "-----BEGIN CERTIFICATE-----\ncontent-cert\n-----END CERTIFICATE-----",
      rejectUnauthorized: true,
    });
  });

  it("enforces TLS certificate verification when a session pooler root certificate is configured", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\\ncontent-cert\\n-----END CERTIFICATE-----";

    const { getInstallDatabaseSslConfig } = await import("@/lib/self-host/install-runtime");

    expect(getInstallDatabaseSslConfig()).toEqual({
      ca: "-----BEGIN CERTIFICATE-----\ncontent-cert\n-----END CERTIFICATE-----",
      rejectUnauthorized: true,
    });
  });

  it("fails clearly when no install database connection string is configured", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "control-secret-key";
    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Missing required environment variable: BASEBUDDY_CONTROL_DATABASE_URL",
    );
  });

  it("fails clearly when the Supabase URL is invalid", async () => {
    process.env.BASEBUDDY_SUPABASE_URL = "not-a-url";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_SUPABASE_SECRET_KEY = "same-project-secret-key";
    process.env.BASEBUDDY_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Invalid Supabase URL in BASEBUDDY_SUPABASE_URL.",
    );
  });

  it("fails clearly when the database URL is invalid", async () => {
    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_SUPABASE_SECRET_KEY = "same-project-secret-key";
    process.env.BASEBUDDY_DATABASE_URL = "not-a-database-url";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Invalid database URL in BASEBUDDY_DATABASE_URL.",
    );
  });

  it("fails clearly when the content-plane database url is missing from the new env contract", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_control";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://control-user:secret@control.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://content.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_content";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "content-secret-key";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Missing required environment variable: BASEBUDDY_CONTENT_DATABASE_URL",
    );
  });

  it("loads shared env-backed S3 storage credentials for media and files", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_S3_ACCESS_KEY_ID = "shared-access-key";
    process.env.BASEBUDDY_S3_SECRET_ACCESS_KEY = "shared-secret-key";

    const { getInstallS3CompatibleStorageCredentials, validateInstallRuntimeConfiguration } =
      await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).not.toThrow();
    expect(getInstallS3CompatibleStorageCredentials("media")).toEqual({
      accessKeyId: "shared-access-key",
      secretAccessKey: "shared-secret-key",
    });
    expect(getInstallS3CompatibleStorageCredentials("files")).toEqual({
      accessKeyId: "shared-access-key",
      secretAccessKey: "shared-secret-key",
    });
  });

  it("lets media and files S3 credentials override the shared env-backed credentials", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_S3_ACCESS_KEY_ID = "shared-access-key";
    process.env.BASEBUDDY_S3_SECRET_ACCESS_KEY = "shared-secret-key";
    process.env.BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID = "media-access-key";
    process.env.BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY = "media-secret-key";
    process.env.BASEBUDDY_FILES_S3_ACCESS_KEY_ID = "files-access-key";
    process.env.BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY = "files-secret-key";

    const { getInstallS3CompatibleStorageCredentials } = await import(
      "@/lib/self-host/install-runtime"
    );

    expect(getInstallS3CompatibleStorageCredentials("media")).toEqual({
      accessKeyId: "media-access-key",
      secretAccessKey: "media-secret-key",
    });
    expect(getInstallS3CompatibleStorageCredentials("files")).toEqual({
      accessKeyId: "files-access-key",
      secretAccessKey: "files-secret-key",
    });
  });

  it("fails startup validation when an optional S3 env pair is incomplete", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    process.env.BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID = "media-access-key";

    const { validateInstallRuntimeConfiguration } = await import("@/lib/self-host/install-runtime");

    expect(() => validateInstallRuntimeConfiguration()).toThrow(
      "Incomplete S3 storage env configuration: set both BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID and BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY.",
    );
  });

  it("marks storage setup diagnostics invalid when an S3 env pair is incomplete", async () => {
    process.env.BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID = "media-access-key";

    const { getInstallSetupStatus } = await import("@/lib/self-host/install-runtime");

    const storageSection = getInstallSetupStatus().sections.find(
      (section) => section.title === "Upload storage",
    );

    expect(storageSection).toMatchObject({
      status: "invalid",
    });
    expect(storageSection?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY",
          status: "missing",
        }),
      ]),
    );
  });

  it("returns a browser-safe setup status without exposing secret values", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_control";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://control-user:secret@control.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://content.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_content";
    process.env.BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY = "content-secret-key";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://content-user:secret@content.local:5432/postgres";

    const { getInstallSetupStatus } = await import("@/lib/self-host/install-runtime");

    const status = getInstallSetupStatus();
    const serialized = JSON.stringify(status);

    expect(status.topology).toBe("split");
    expect(status.sections.find((section) => section.title === "App configuration")?.status).toBe(
      "ready",
    );
    expect(status.sections.map((section) => section.title)).toEqual([
      "App configuration",
      "Workspace connection",
      "BaseBuddy tables",
      "Sign-in",
      "Content connection",
      "Upload storage",
      "Install layout",
    ]);
    expect(serialized).not.toContain("control-secret-key");
    expect(serialized).not.toContain("content-secret-key");
    expect(serialized).not.toContain("control-user:secret");
    expect(serialized).toContain("postgresql://user:password@control.local:5432/postgres");
    expect(serialized).toContain("set:");
  });

  it("includes control-plane schema readiness checks in setup diagnostics", async () => {
    const { getInstallSetupStatus } = await import("@/lib/self-host/install-runtime");

    const status = getInstallSetupStatus({
      controlPlaneSchemaSection: {
        checks: [
          {
            key: "BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION",
            label: "Control-plane schema version",
            required: true,
            status: "ready",
            value: "v1",
          },
          {
            key: "BASEBUDDY_CONTROL_PLANE_RPCS",
            label: "Required RPCs",
            required: true,
            status: "ready",
            value: "ready",
          },
        ],
        description: "BaseBuddy tables, RPCs, grants, and migration readiness.",
        status: "ready",
        title: "Control-plane schema",
      },
    });

    const schemaSection = status.sections.find((section) => section.title === "BaseBuddy tables");

    expect(schemaSection?.status).toBe("ready");
    expect(schemaSection?.checks.map((check) => check.key)).toEqual([
      "BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION",
      "BASEBUDDY_CONTROL_PLANE_RPCS",
    ]);
  });

  it("builds a ready control-plane schema setup section from the readiness RPC", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc: vi.fn().mockResolvedValue({
          data: {
            expectedSchemaVersion: 1,
            missingPermissions: [],
            missingRpcs: [],
            missingRoles: [],
            missingSchemas: [],
            missingTables: [],
            ready: true,
            schemaVersion: 1,
          },
          error: null,
        }),
      }),
    }));

    const { getControlPlaneSchemaSetupSection } = await import("@/lib/self-host/install-runtime");

    const section = await getControlPlaneSchemaSetupSection();

    expect(section.status).toBe("ready");
    expect(section.checks).toEqual([
      expect.objectContaining({
        key: "BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION",
        status: "ready",
        value: "v1",
      }),
      expect.objectContaining({
        key: "BASEBUDDY_CONTROL_PLANE_SCHEMAS",
        status: "ready",
        value: "ready",
      }),
      expect.objectContaining({
        key: "BASEBUDDY_CONTROL_PLANE_TABLES",
        status: "ready",
        value: "ready",
      }),
      expect.objectContaining({
        key: "BASEBUDDY_CONTROL_PLANE_ROLES",
        status: "ready",
        value: "ready",
      }),
      expect.objectContaining({
        key: "BASEBUDDY_CONTROL_PLANE_PERMISSIONS",
        status: "ready",
        value: "ready",
      }),
      expect.objectContaining({
        key: "BASEBUDDY_CONTROL_PLANE_RPCS",
        status: "ready",
        value: "ready",
      }),
    ]);
  });

  it("marks control-plane schema setup missing when required tables or RPCs are absent", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc: vi.fn().mockResolvedValue({
          data: {
            expectedSchemaVersion: 1,
            missingPermissions: ["mapping.write"],
            missingRpcs: ["public.get_project_content_mapping(uuid)"],
            missingRoles: ["editor"],
            missingSchemas: ["private"],
            missingTables: ["private.basebuddy_project_content_mapping_revisions"],
            ready: false,
            schemaVersion: 1,
          },
          error: null,
        }),
      }),
    }));

    const { getControlPlaneSchemaSetupSection } = await import("@/lib/self-host/install-runtime");

    const section = await getControlPlaneSchemaSetupSection();

    expect(section.status).toBe("missing");
    expect(JSON.stringify(section)).toContain("private");
    expect(JSON.stringify(section)).toContain("editor");
    expect(JSON.stringify(section)).toContain("mapping.write");
    expect(JSON.stringify(section)).toContain("private.basebuddy_project_content_mapping_revisions");
    expect(JSON.stringify(section)).toContain("public.get_project_content_mapping(uuid)");
  });

  it("fails control-plane schema readiness quickly when the RPC hangs", async () => {
    vi.useFakeTimers();
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY = "control-secret-key";

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc: vi.fn().mockReturnValue(new Promise(() => undefined)),
      }),
    }));

    const { getControlPlaneSchemaSetupSection } = await import("@/lib/self-host/install-runtime");
    const sectionPromise = getControlPlaneSchemaSetupSection();

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(sectionPromise).resolves.toMatchObject({
      checks: [
        expect.objectContaining({
          key: "BASEBUDDY_CONTROL_PLANE_READINESS_RPC",
          status: "invalid",
          value: "check failed",
        }),
      ],
      status: "invalid",
    });
  });

  it("builds ready Supabase and database reachability sections without exposing secrets", async () => {
    process.env.BASEBUDDY_CONTROL_SUPABASE_URL = "https://control.supabase.co";
    process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_control";
    process.env.BASEBUDDY_CONTROL_DATABASE_URL =
      "postgresql://control-user:secret@control.local:5432/postgres";
    process.env.BASEBUDDY_CONTENT_SUPABASE_URL = "https://content.supabase.co";
    process.env.BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_content";
    process.env.BASEBUDDY_CONTENT_DATABASE_URL =
      "postgresql://content-user:secret@content.local:5432/postgres";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ external: { google: true } }),
    });
    const queryDatabaseMock = vi.fn().mockResolvedValue(undefined);

    const {
      getAuthEndpointSetupSection,
      getDatabaseConnectionSetupSections,
      getSupabaseApiSetupSection,
    } = await import("@/lib/self-host/install-runtime");

    const supabaseSection = await getSupabaseApiSetupSection({ fetch: fetchMock });
    const authSection = await getAuthEndpointSetupSection({ fetch: fetchMock });
    const databaseSections = await getDatabaseConnectionSetupSections({
      queryDatabase: queryDatabaseMock,
    });

    expect(supabaseSection).toMatchObject({ status: "ready" });
    expect(supabaseSection.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Workspace project reference",
          status: "ready",
          value: "control",
        }),
      ]),
    );
    expect(authSection).toMatchObject({ status: "ready" });
    expect(authSection.checks[1]).toEqual(
      expect.objectContaining({
        key: "Workspace project providers",
        status: "ready",
        value: "google",
      }),
    );
    expect(databaseSections).toEqual([
      expect.objectContaining({ status: "ready", title: "Workspace database" }),
      expect.objectContaining({ status: "ready", title: "Content database" }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://control.supabase.co/rest/v1/",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "sb_publishable_control",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://content.supabase.co/auth/v1/settings",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "sb_publishable_content",
        }),
      }),
    );
    expect(queryDatabaseMock).toHaveBeenCalledWith(
      "postgresql://control-user:secret@control.local:5432/postgres",
    );
    const serialized = JSON.stringify([supabaseSection, authSection, databaseSections]);

    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("sb_publishable_control");
  });

  it("marks reachability sections invalid when configured endpoints cannot be reached", async () => {
    process.env.BASEBUDDY_SUPABASE_URL = "https://demo.supabase.co";
    process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.BASEBUDDY_DATABASE_URL =
      "postgresql://postgres:secret@db.local:5432/postgres";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    });
    const queryDatabaseMock = vi.fn().mockRejectedValue(new Error("password authentication failed"));

    const {
      getAuthEndpointSetupSection,
      getDatabaseConnectionSetupSections,
      getSupabaseApiSetupSection,
    } = await import("@/lib/self-host/install-runtime");

    const supabaseSection = await getSupabaseApiSetupSection({ fetch: fetchMock });
    const authSection = await getAuthEndpointSetupSection({ fetch: fetchMock });
    const databaseSections = await getDatabaseConnectionSetupSections({
      queryDatabase: queryDatabaseMock,
    });

    expect(supabaseSection.status).toBe("invalid");
    expect(authSection.status).toBe("invalid");
    expect(databaseSections[0]?.status).toBe("invalid");
    expect(JSON.stringify(databaseSections)).not.toContain("password authentication failed");
  });
});
