import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/control-plane/server", () => ({
  getAuthenticatedApiRequestContext: vi.fn(),
}));

import {
  getContentRouteErrorMessage,
  getContentRouteErrorStatus,
} from "@/app/api/projects/[projectId]/content/shared";
import {
  assertContentDatabaseCircuitClosed,
  CONTENT_DATABASE_CONNECTION_TIMEOUT_MS,
  CONTENT_DATABASE_DEGRADED_COOLDOWN_MS,
  CONTENT_DATABASE_QUERY_TIMEOUT_MS,
  CONTENT_DATABASE_STATEMENT_TIMEOUT_MS,
  isContentDatabaseTimeoutLikeError,
  noteContentDatabaseFailure,
  noteContentDatabaseSuccess,
  resetContentDatabaseDegradedCircuit,
} from "@/lib/content-runtime/content-database-resilience";

describe("content database resilience", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetContentDatabaseDegradedCircuit();
  });

  it("uses fast-fail timeout budgets for content database access", () => {
    expect(CONTENT_DATABASE_CONNECTION_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(CONTENT_DATABASE_QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(CONTENT_DATABASE_STATEMENT_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });

  it("detects timeout-like content database failures", () => {
    expect(
      isContentDatabaseTimeoutLikeError("canceling statement due to statement timeout"),
    ).toBe(true);
    expect(
      isContentDatabaseTimeoutLikeError("Connection terminated due to connection timeout"),
    ).toBe(true);
    expect(isContentDatabaseTimeoutLikeError("ETIMEDOUT while acquiring client")).toBe(true);
    expect(isContentDatabaseTimeoutLikeError("password authentication failed")).toBe(false);
  });

  it("maps timeout-like content route errors to a degraded-state response", () => {
    const message = getContentRouteErrorMessage(
      new Error("canceling statement due to statement timeout"),
    );

    expect(message).toContain("BaseBuddy is having trouble reaching this project's content");
    expect(getContentRouteErrorStatus(message)).toBe(503);
  });

  it("opens a tenant-scoped degraded circuit after a timeout-like failure", () => {
    noteContentDatabaseFailure(
      "postgresql://tenant-a",
      new Error("canceling statement due to statement timeout"),
    );

    expect(() => assertContentDatabaseCircuitClosed("postgresql://tenant-a")).toThrow(
      /having trouble reaching this project's content right now/i,
    );
    expect(() => assertContentDatabaseCircuitClosed("postgresql://tenant-b")).not.toThrow();
  });

  it("resets the degraded circuit after a successful database operation", () => {
    noteContentDatabaseFailure(
      "postgresql://tenant-a",
      new Error("canceling statement due to statement timeout"),
    );

    noteContentDatabaseSuccess("postgresql://tenant-a");

    expect(() => assertContentDatabaseCircuitClosed("postgresql://tenant-a")).not.toThrow();
  });

  it("reopens the tenant after the degraded cooldown window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T06:00:00.000Z"));

    noteContentDatabaseFailure(
      "postgresql://tenant-a",
      new Error("canceling statement due to statement timeout"),
    );

    vi.setSystemTime(
      new Date(Date.now() + CONTENT_DATABASE_DEGRADED_COOLDOWN_MS + 1),
    );

    expect(() => assertContentDatabaseCircuitClosed("postgresql://tenant-a")).not.toThrow();
  });
});
