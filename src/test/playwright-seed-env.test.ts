import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolvePlaywrightSeedDatabaseUrl,
  resolvePlaywrightSeedContentSupabaseSecretKey,
  resolvePlaywrightSeedContentSupabaseUrl,
  resolvePlaywrightSeedRootCertificate,
  resolvePlaywrightSeedRootCertificateFile,
  resolvePlaywrightSeedProjectName,
  resolvePlaywrightSeedProjectSlug,
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

  it("prefers the content database env for the seeded content fixtures", () => {
    expect(
      resolvePlaywrightSeedDatabaseUrl({
        BASEBUDDY_CONTENT_DATABASE_URL: "postgresql://content",
        DATABASE_URL: "postgresql://primary",
        POSTGRES_URL: "postgresql://fallback-postgres",
        SUPABASE_DATABASE_URL: "postgresql://fallback-supabase",
      }),
    ).toBe("postgresql://content");

    expect(
      resolvePlaywrightSeedDatabaseUrl({
        DATABASE_URL: "postgresql://primary",
      }),
    ).toBeNull();
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
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE: "runtime-inline-cert",
      }),
    ).toBe("playwright-inline-cert");

    expect(
      resolvePlaywrightSeedRootCertificate({
        BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE: "content-inline-cert",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE: "runtime-inline-cert",
      }),
    ).toBe("content-inline-cert");

    expect(
      resolvePlaywrightSeedRootCertificate({
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE: "runtime-inline-cert",
      }),
    ).toBeNull();

    expect(
      resolvePlaywrightSeedRootCertificateFile({
        PLAYWRIGHT_DATABASE_ROOT_CERTIFICATE_FILE: "./certs/playwright.pem",
        BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/content.pem",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/runtime.pem",
      }),
    ).toBe("./certs/playwright.pem");

    expect(
      resolvePlaywrightSeedRootCertificateFile({
        BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/content.pem",
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/runtime.pem",
      }),
    ).toBe("./certs/content.pem");

    expect(
      resolvePlaywrightSeedRootCertificateFile({
        SUPABASE_SESSION_POOLER_ROOT_CERTIFICATE_FILE: "./certs/runtime.pem",
      }),
    ).toBeNull();
  });

  it("prefers BaseBuddy Supabase envs for seeded image and file fixtures", () => {
    expect(
      resolvePlaywrightSeedContentSupabaseUrl({
        BASEBUDDY_SUPABASE_URL: "http://127.0.0.1:56321",
      }),
    ).toBe("http://127.0.0.1:56321");

    expect(
      resolvePlaywrightSeedContentSupabaseSecretKey({
        BASEBUDDY_SUPABASE_SECRET_KEY: "storage-secret",
      }),
    ).toBe("storage-secret");
  });

  it("does not fall back to app-state Supabase envs for seeded storage", () => {
    expect(
      resolvePlaywrightSeedContentSupabaseUrl({
        [`BASEBUDDY_${"CONTROL"}_SUPABASE_URL`]: "https://control.supabase.co",
      }),
    ).toBeNull();

    expect(
      resolvePlaywrightSeedContentSupabaseSecretKey({
        [`BASEBUDDY_${"CONTROL"}_SUPABASE_SECRET_KEY`]: "control-secret",
      }),
    ).toBeNull();
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
    expect(seedScript).toContain("createBaseBuddyConfigUser");
    expect(seedScript).toContain("saveConfigProjectContentMappingRevision");
    expect(seedScript).toContain("connectionString: env.contentDatabaseUrl");
    expect(seedScript).toContain("basebuddy.config.json");
    expect(seedScript).toContain("Connect seed database");
    expect(seedScript).toContain("ECHECKOUTTIMEOUT");
    expect(seedScript).not.toContain("signInAsUser");
    expect(seedScript).not.toContain("signInWithPassword");
    expect(seedScript).not.toContain(["basebuddy", "project"].join("_"));
    expect(seedScript).not.toContain(["basebuddy", "profiles"].join("_"));
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
      resolvePlaywrightSeedDatabaseUrl({
        BASEBUDDY_CONTENT_DATABASE_URL:
          "postgresql://postgres:your-password@db.your-content-project-ref.supabase.co:5432/postgres",
        DATABASE_URL: "postgresql://real",
      }),
    ).toBeNull();
  });
});
