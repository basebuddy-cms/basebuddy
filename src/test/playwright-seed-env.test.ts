import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolvePlaywrightSeedDatabaseUrl,
  resolvePlaywrightSeedControlDatabaseUrl,
  resolvePlaywrightSeedContentSupabaseSecretKey,
  resolvePlaywrightSeedContentSupabaseUrl,
  resolvePlaywrightSeedPublishableKey,
  resolvePlaywrightSeedRootCertificate,
  resolvePlaywrightSeedRootCertificateFile,
  resolvePlaywrightSeedProjectName,
  resolvePlaywrightSeedProjectSlug,
  resolvePlaywrightSeedSupabaseUrl,
  shouldUsePlaywrightSeedDatabaseSsl,
} from "../../e2e/support/seed-env";

describe("playwright seed env helpers", () => {
  it("uses canonical self-host seed project envs", () => {
    const env = {
      PLAYWRIGHT_EXISTING_DB_PROJECT_NAME: "Legacy mapped content",
      PLAYWRIGHT_EXISTING_DB_PROJECT_SLUG: "legacy-existing-db",
      PLAYWRIGHT_PROJECT_NAME: "Playwright Self Host",
      PLAYWRIGHT_PROJECT_SLUG: "playwright-self-host",
    } satisfies Partial<NodeJS.ProcessEnv>;

    expect(resolvePlaywrightSeedProjectName(env)).toBe("Playwright Self Host");
    expect(resolvePlaywrightSeedProjectSlug(env)).toBe("playwright-self-host");
  });

  it("does not accept legacy existing-db smoke project envs", () => {
    const env = {
      PLAYWRIGHT_EXISTING_DB_PROJECT_NAME: "Legacy mapped content",
      PLAYWRIGHT_EXISTING_DB_PROJECT_SLUG: "legacy-existing-db",
    } satisfies Partial<NodeJS.ProcessEnv>;

    expect(resolvePlaywrightSeedProjectName(env)).toBeNull();
    expect(resolvePlaywrightSeedProjectSlug(env)).toBeNull();
  });

  it("prefers the content-plane database env for the seeded content fixtures", () => {
    expect(
      resolvePlaywrightSeedDatabaseUrl({
        BASEBUDDY_CONTENT_DATABASE_URL: "postgresql://content",
        BASEBUDDY_CONTROL_DATABASE_URL: "postgresql://control",
        DATABASE_URL: "postgresql://primary",
        POSTGRES_URL: "postgresql://fallback-postgres",
        SUPABASE_DATABASE_URL: "postgresql://fallback-supabase",
      }),
    ).toBe("postgresql://content");

    expect(
      resolvePlaywrightSeedDatabaseUrl({
        BASEBUDDY_CONTROL_DATABASE_URL: "postgresql://control",
      }),
    ).toBe("postgresql://control");
  });

  it("prefers the control-plane database env for seeded BaseBuddy control rows", () => {
    expect(
      resolvePlaywrightSeedControlDatabaseUrl({
        BASEBUDDY_CONTENT_DATABASE_URL: "postgresql://content",
        BASEBUDDY_CONTROL_DATABASE_URL: "postgresql://control",
      }),
    ).toBe("postgresql://control");

    expect(
      resolvePlaywrightSeedControlDatabaseUrl({
        BASEBUDDY_CONTENT_DATABASE_URL: "postgresql://content",
      }),
    ).toBe("postgresql://content");
  });

  it("does not accept legacy install database env fallbacks for the seed harness", () => {
    expect(
      resolvePlaywrightSeedDatabaseUrl({
        DATABASE_URL: "postgresql://primary",
        POSTGRES_URL: "postgresql://fallback-postgres",
        SUPABASE_DATABASE_URL: "postgresql://fallback-supabase",
      }),
    ).toBeNull();

    expect(
      resolvePlaywrightSeedDatabaseUrl({
        SUPABASE_DATABASE_URL: "postgresql://fallback-supabase",
      }),
    ).toBeNull();
  });

  it("accepts the self-host runtime root certificate envs as seed fallbacks", () => {
    expect(
      resolvePlaywrightSeedRootCertificate({
        PLAYWRIGHT_DATABASE_ROOT_CERTIFICATE: "playwright-inline-cert",
        BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE: "content-inline-cert",
        BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE: "control-inline-cert",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE: "runtime-inline-cert",
      }),
    ).toBe("playwright-inline-cert");

    expect(
      resolvePlaywrightSeedRootCertificate({
        BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE: "content-inline-cert",
        BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE: "control-inline-cert",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE: "runtime-inline-cert",
      }),
    ).toBe("content-inline-cert");

    expect(
      resolvePlaywrightSeedRootCertificate({
        BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE: "control-inline-cert",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE: "runtime-inline-cert",
      }),
    ).toBe("control-inline-cert");

    expect(
      resolvePlaywrightSeedRootCertificateFile({
        PLAYWRIGHT_DATABASE_ROOT_CERTIFICATE_FILE: "./certs/playwright.pem",
        BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/content.pem",
        BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/control.pem",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/runtime.pem",
      }),
    ).toBe("./certs/playwright.pem");

    expect(
      resolvePlaywrightSeedRootCertificateFile({
        BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/content.pem",
        BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/control.pem",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/runtime.pem",
      }),
    ).toBe("./certs/content.pem");

    expect(
      resolvePlaywrightSeedRootCertificateFile({
        BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/control.pem",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/runtime.pem",
      }),
    ).toBe("./certs/control.pem");
  });

  it("prefers BaseBuddy control-plane Supabase envs for the seeded browser harness", () => {
    expect(
      resolvePlaywrightSeedSupabaseUrl({
        BASEBUDDY_CONTROL_SUPABASE_URL: "https://control.supabase.co",
        NEXT_PUBLIC_BASEBUDDY_SUPABASE_URL: "https://canonical.supabase.co",
        NEXT_PUBLIC_SUPABASE_URL: "https://legacy.supabase.co",
      }),
    ).toBe("https://control.supabase.co");

    expect(
      resolvePlaywrightSeedPublishableKey({
        BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_control",
        NEXT_PUBLIC_BASEBUDDY_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_canonical",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_legacy",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_anon_legacy",
      }),
    ).toBe("sb_publishable_control");
  });

  it("prefers BaseBuddy content-plane Supabase envs for seeded storage fixtures", () => {
    expect(
      resolvePlaywrightSeedContentSupabaseUrl({
        BASEBUDDY_CONTENT_SUPABASE_URL: "http://127.0.0.1:56321",
        BASEBUDDY_CONTROL_SUPABASE_URL: "https://control.supabase.co",
      }),
    ).toBe("http://127.0.0.1:56321");

    expect(
      resolvePlaywrightSeedContentSupabaseSecretKey({
        BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY: "content-secret",
        BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY: "control-secret",
      }),
    ).toBe("content-secret");
  });

  it("falls back to control-plane Supabase envs for seeded storage in unified installs", () => {
    expect(
      resolvePlaywrightSeedContentSupabaseUrl({
        BASEBUDDY_CONTROL_SUPABASE_URL: "https://control.supabase.co",
      }),
    ).toBe("https://control.supabase.co");

    expect(
      resolvePlaywrightSeedContentSupabaseSecretKey({
        BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY: "control-secret",
      }),
    ).toBe("control-secret");
  });

  it("keeps schema-zoo smoke scripts aligned with the Playwright owner account", () => {
    const seedScript = readFileSync(join(process.cwd(), "scripts", "smoke-schema-zoo.ts"), "utf8");
    const verifyScript = readFileSync(
      join(process.cwd(), "scripts", "smoke-schema-zoo-app-verify.ts"),
      "utf8",
    );
    const startScript = readFileSync(
      join(process.cwd(), "scripts", "start-playwright-server.mjs"),
      "utf8",
    );
    const envScript = readFileSync(join(process.cwd(), "e2e", "support", "env.ts"), "utf8");

    expect(seedScript).toContain('loadDotEnvFile(".env.playwright", { override: true })');
    expect(verifyScript).toContain('loadDotEnvFile(".env.playwright", { override: true })');
    expect(startScript).toContain('loadDotEnvFile(".env.playwright", { override: true })');
    expect(envScript).toContain('loadDotEnvFile(".env.playwright", { override: true })');
    expect(verifyScript).toContain('headers.set("origin", context.baseUrl)');
    expect(seedScript).toContain("override: true");
    expect(verifyScript).toContain("override: true");
    expect(seedScript).toContain("process.env.PLAYWRIGHT_OWNER_EMAIL");
  });

  it("keeps global Playwright seeding independent from password sign-in availability", () => {
    const seedScript = readFileSync(join(process.cwd(), "e2e", "setup", "seed.ts"), "utf8");

    expect(seedScript).toContain("createSeedProjectWithDatabase");
    expect(seedScript).toContain("connectionString: env.controlDatabaseUrl");
    expect(seedScript).toContain("connectionString: env.contentDatabaseUrl");
    expect(seedScript).toContain("cachedSeedState.controlPlaneUrl !== env.appUrl");
    expect(seedScript).toContain("Connect seed database");
    expect(seedScript).toContain("ECHECKOUTTIMEOUT");
    expect(seedScript).not.toContain("signInAsUser");
    expect(seedScript).not.toContain("signInWithPassword");
  });

  it("enables SSL automatically for Supabase pooler seed database URLs", () => {
    expect(
      shouldUsePlaywrightSeedDatabaseSsl(
        {},
        "postgresql://postgres:password@aws-1-us-west-1.pooler.supabase.com:5432/postgres",
      ),
    ).toBe(true);

    expect(
      shouldUsePlaywrightSeedDatabaseSsl(
        {},
        "postgresql://postgres:password@db.example.local:5432/postgres",
      ),
    ).toBe(false);
  });

  it("lets explicit Playwright seed SSL env override URL inference", () => {
    expect(
      shouldUsePlaywrightSeedDatabaseSsl(
        { PLAYWRIGHT_DATABASE_SSL: "0" },
        "postgresql://postgres:password@aws-1-us-west-1.pooler.supabase.com:5432/postgres",
      ),
    ).toBe(false);

    expect(
      shouldUsePlaywrightSeedDatabaseSsl(
        { PLAYWRIGHT_DATABASE_SSL: "1" },
        "postgresql://postgres:password@db.example.local:5432/postgres",
      ),
    ).toBe(true);
  });

  it("ignores public example placeholders without falling back to legacy seed envs", () => {
    expect(
      resolvePlaywrightSeedSupabaseUrl({
        BASEBUDDY_CONTROL_SUPABASE_URL: "https://your-control-project-ref.supabase.co",
        NEXT_PUBLIC_BASEBUDDY_SUPABASE_URL: "https://real.supabase.co",
      }),
    ).toBeNull();

    expect(
      resolvePlaywrightSeedPublishableKey({
        BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
        NEXT_PUBLIC_BASEBUDDY_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_real",
      }),
    ).toBeNull();

    expect(
      resolvePlaywrightSeedDatabaseUrl({
        BASEBUDDY_CONTENT_DATABASE_URL:
          "postgresql://postgres:your-password@db.your-content-project-ref.supabase.co:5432/postgres",
        DATABASE_URL: "postgresql://real",
      }),
    ).toBeNull();
  });
});
