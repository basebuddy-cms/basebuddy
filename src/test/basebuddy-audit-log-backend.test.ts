import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fixedNow = "2026-05-27T00:00:00.000Z";

describe("BaseBuddy audit log backend", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-audit-backend-"));
    process.chdir(tempDir);
    vi.unstubAllEnvs();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("keeps local audit events in basebuddy-data by default", async () => {
    const { appendBaseBuddyAuditEvent, getBaseBuddyAuditLogPath } = await import(
      "@/lib/basebuddy-config/audit-log"
    );

    await appendBaseBuddyAuditEvent({
      actorEmail: "owner@example.com",
      type: "auth.login.success",
    });

    const rawLog = await readFile(getBaseBuddyAuditLogPath(), "utf8");

    expect(rawLog).toContain("auth.login.success");
    expect(rawLog).toContain("owner@example.com");
  });
});
