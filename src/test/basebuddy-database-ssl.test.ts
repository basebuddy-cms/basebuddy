import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BASEBUDDY_CONTENT_DATABASE_ROOT_CERTIFICATE_ENV,
  BASEBUDDY_CONTENT_DATABASE_ROOT_CERTIFICATE_FILE_ENV,
  getBaseBuddyPostgresSslConfig,
} from "@/lib/basebuddy-config/database-ssl";

describe("BaseBuddy Postgres SSL config", () => {
  it("disables TLS for local databases", () => {
    expect(getBaseBuddyPostgresSslConfig("postgresql://user:pass@127.0.0.1:5432/postgres", {})).toBe(
      false,
    );
  });

  it("rejects no-verify mode", () => {
    expect(() =>
      getBaseBuddyPostgresSslConfig(
        "postgresql://user:pass@db.example.com:5432/postgres?sslmode=no-verify",
        {},
      ),
    ).toThrow(/sslmode=no-verify/);
  });

  it("uses an inline root certificate from env", () => {
    expect(
      getBaseBuddyPostgresSslConfig("postgresql://user:pass@db.example.com:5432/postgres", {
        [BASEBUDDY_CONTENT_DATABASE_ROOT_CERTIFICATE_ENV]:
          "-----BEGIN CERTIFICATE-----\\ninline\\n-----END CERTIFICATE-----",
      }),
    ).toEqual({
      ca: "-----BEGIN CERTIFICATE-----\ninline\n-----END CERTIFICATE-----",
      rejectUnauthorized: true,
    });
  });

  it("uses a root certificate file from env", () => {
    const dir = mkdtempSync(join(tmpdir(), "basebuddy-ssl-"));
    const certPath = join(dir, "root.pem");
    writeFileSync(certPath, "root-cert", "utf8");

    expect(
      getBaseBuddyPostgresSslConfig("postgresql://user:pass@db.example.com:5432/postgres", {
        [BASEBUDDY_CONTENT_DATABASE_ROOT_CERTIFICATE_FILE_ENV]: certPath,
      }),
    ).toEqual({
      ca: "root-cert",
      rejectUnauthorized: true,
    });
  });
});
