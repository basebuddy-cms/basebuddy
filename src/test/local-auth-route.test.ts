import { scrypt } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { getBaseBuddyAuditLogPath } from "@/lib/basebuddy-config/audit-log";
import {
  createDefaultBaseBuddyConfig,
  type BaseBuddyConfig,
} from "@/lib/basebuddy-config/schema";

const scryptAsync = promisify(scrypt);
const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";
const password = "correct-password-123";

const hashPasswordForTest = async (plainTextPassword: string, salt: string) =>
  ((await scryptAsync(plainTextPassword, salt, 64)) as Buffer).toString("base64url");

const readConfig = async () =>
  JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8")) as BaseBuddyConfig;

const readAuditEvents = async () => {
  const contents = await readFile(getBaseBuddyAuditLogPath(), "utf8");

  return contents.trim().split("\n").map((line) => JSON.parse(line));
};

describe("local auth routes", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    const { clearBaseBuddyLoginProtectionStore } = await import(
      "@/lib/basebuddy-config/login-protection"
    );

    clearBaseBuddyLoginProtectionStore();
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv(
      "BASEBUDDY_CONTENT_DATABASE_URL",
      "postgresql://content-user:db-pass@example.com:5432/postgres",
    );
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-local-auth-route-"));
    process.chdir(tempDir);
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
      passwordHash: await hashPasswordForTest(password, passwordSalt),
      passwordHashParams: {
        keyLength: 64,
        name: "scrypt",
      },
      passwordSalt,
      updatedAt: fixedNow,
    });

    await writeFile(getBaseBuddyConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("login creates an HttpOnly signed cookie and stores only a session token hash", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        body: JSON.stringify({
          email: "owner@example.com",
          password,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";
    const config = await readConfig();
    const sessionCookieValue = setCookie.match(/basebuddy_session=([^;]+)/)?.[1];

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookieValue).toBeTruthy();
    expect(config.sessions).toHaveLength(1);
    expect(config.sessions[0]).toMatchObject({
      userId: "user_owner",
    });
    expect(config.sessions[0].tokenHash).not.toContain(sessionCookieValue ?? "");
    expect(JSON.stringify(config)).not.toContain(sessionCookieValue ?? "");
    expect(JSON.stringify(config)).not.toContain(password);

    const auditEvents = await readAuditEvents();

    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorEmail: "owner@example.com",
        actorUserId: "user_owner",
        type: "auth.login.success",
      }),
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain(password);
  });

  it("keeps production-start login cookies usable on local http", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(
      new Request("http://localhost:3100/api/auth/login", {
        body: JSON.stringify({
          email: "owner@example.com",
          password,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).not.toMatch(/;\s*Secure/i);
  });

  it("marks production login cookies secure when the request is https", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(
      new Request("http://basebuddy.example/api/auth/login", {
        body: JSON.stringify({
          email: "owner@example.com",
          password,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-proto": "https",
        },
        method: "POST",
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toMatch(/;\s*Secure/i);
  });

  it("login rejects invalid credentials without creating a session", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        body: JSON.stringify({
          email: "owner@example.com",
          password: "wrong-password",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const body = await response.json();
    const config = await readConfig();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid email or password." });
    expect(config.sessions).toHaveLength(0);

    const auditEvents = await readAuditEvents();

    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorEmail: "owner@example.com",
        actorUserId: null,
        type: "auth.login.failure",
      }),
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain("wrong-password");
  });

  it("backs off repeated failed logins by email and IP without revealing which one matched", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(
        new Request("http://localhost/api/auth/login", {
          body: JSON.stringify({
            email: "owner@example.com",
            password: "wrong-password",
          }),
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `203.0.113.${attempt + 1}`,
          },
          method: "POST",
        }),
      );

      expect(response.status).toBe(401);
    }

    const lockedByEmailResponse = await POST(
      new Request("http://localhost/api/auth/login", {
        body: JSON.stringify({
          email: "owner@example.com",
          password,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.99",
        },
        method: "POST",
      }),
    );
    const lockedBody = await lockedByEmailResponse.json();
    const config = await readConfig();

    expect(lockedByEmailResponse.status).toBe(429);
    expect(lockedBody).toEqual({
      error: "Too many failed sign-in attempts. Please wait a few minutes and try again.",
    });
    expect(lockedByEmailResponse.headers.get("Retry-After")).toBeTruthy();
    expect(config.sessions).toHaveLength(0);
  });

  it("logout clears the browser cookie and removes the matching config session", async () => {
    const loginRoute = await import("@/app/api/auth/login/route");
    const logoutRoute = await import("@/app/api/auth/logout/route");
    const loginResponse = await loginRoute.POST(
      new Request("http://localhost/api/auth/login", {
        body: JSON.stringify({
          email: "owner@example.com",
          password,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const cookieHeader = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";

    const logoutResponse = await logoutRoute.POST(
      new Request("http://localhost/api/auth/logout", {
        headers: {
          Cookie: cookieHeader,
        },
        method: "POST",
      }),
    );
    const body = await logoutResponse.json();
    const config = await readConfig();

    expect(logoutResponse.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(logoutResponse.headers.get("set-cookie")).toContain("basebuddy_session=");
    expect(logoutResponse.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect(config.sessions).toHaveLength(0);

    const auditEvents = await readAuditEvents();

    expect(auditEvents.map((event) => event.type)).toEqual([
      "auth.login.success",
      "auth.logout",
    ]);
  });
});
