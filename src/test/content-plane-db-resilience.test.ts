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
  assertContentPlaneDatabaseCircuitClosed,
  CONTENT_PLANE_CONNECTION_TIMEOUT_MS,
  CONTENT_PLANE_DEGRADED_DATABASE_COOLDOWN_MS,
  CONTENT_PLANE_QUERY_TIMEOUT_MS,
  CONTENT_PLANE_STATEMENT_TIMEOUT_MS,
  isContentPlaneDatabaseTimeoutLikeError,
  noteContentPlaneDatabaseFailure,
  noteContentPlaneDatabaseSuccess,
  resetContentPlaneDatabaseDegradedCircuit,
} from "@/lib/content-runtime/content-plane-db-resilience";

describe("content-plane database resilience", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetContentPlaneDatabaseDegradedCircuit();
  });

  it("uses fast-fail timeout budgets for content-plane database access", () => {
    expect(CONTENT_PLANE_CONNECTION_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(CONTENT_PLANE_QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(CONTENT_PLANE_STATEMENT_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });

  it("detects timeout-like content-plane database failures", () => {
    expect(
      isContentPlaneDatabaseTimeoutLikeError("canceling statement due to statement timeout"),
    ).toBe(true);
    expect(
      isContentPlaneDatabaseTimeoutLikeError("Connection terminated due to connection timeout"),
    ).toBe(true);
    expect(isContentPlaneDatabaseTimeoutLikeError("ETIMEDOUT while acquiring client")).toBe(true);
    expect(isContentPlaneDatabaseTimeoutLikeError("password authentication failed")).toBe(false);
  });

  it("maps timeout-like content route errors to a degraded-state response", () => {
    const message = getContentRouteErrorMessage(
      new Error("canceling statement due to statement timeout"),
    );

    expect(message).toContain("BaseBuddy is having trouble reaching this project's content");
    expect(getContentRouteErrorStatus(message)).toBe(503);
  });

  it("opens a tenant-scoped degraded circuit after a timeout-like failure", () => {
    noteContentPlaneDatabaseFailure(
      "postgresql://tenant-a",
      new Error("canceling statement due to statement timeout"),
    );

    expect(() => assertContentPlaneDatabaseCircuitClosed("postgresql://tenant-a")).toThrow(
      /having trouble reaching this project's content right now/i,
    );
    expect(() => assertContentPlaneDatabaseCircuitClosed("postgresql://tenant-b")).not.toThrow();
  });

  it("resets the degraded circuit after a successful database operation", () => {
    noteContentPlaneDatabaseFailure(
      "postgresql://tenant-a",
      new Error("canceling statement due to statement timeout"),
    );

    noteContentPlaneDatabaseSuccess("postgresql://tenant-a");

    expect(() => assertContentPlaneDatabaseCircuitClosed("postgresql://tenant-a")).not.toThrow();
  });

  it("reopens the tenant after the degraded cooldown window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T06:00:00.000Z"));

    noteContentPlaneDatabaseFailure(
      "postgresql://tenant-a",
      new Error("canceling statement due to statement timeout"),
    );

    vi.setSystemTime(
      new Date(Date.now() + CONTENT_PLANE_DEGRADED_DATABASE_COOLDOWN_MS + 1),
    );

    expect(() => assertContentPlaneDatabaseCircuitClosed("postgresql://tenant-a")).not.toThrow();
  });
});
