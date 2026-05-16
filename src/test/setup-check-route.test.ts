import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enforceRateLimitMock,
  getAuthEndpointSetupSectionMock,
  getControlPlaneSchemaSetupSectionMock,
  getDatabaseConnectionSetupSectionsMock,
  getInstallSetupStatusMock,
  isInstallSetupReadyMock,
} = vi.hoisted(() => ({
  enforceRateLimitMock: vi.fn(() => null),
  getAuthEndpointSetupSectionMock: vi.fn(),
  getControlPlaneSchemaSetupSectionMock: vi.fn(),
  getDatabaseConnectionSetupSectionsMock: vi.fn(),
  getInstallSetupStatusMock: vi.fn(),
  isInstallSetupReadyMock: vi.fn(),
}));

vi.mock("@/lib/api/request-guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/request-guards")>();

  return {
    ...actual,
    enforceRateLimit: enforceRateLimitMock,
  };
});

vi.mock("@/lib/self-host/install-runtime", () => ({
  getAuthEndpointSetupSection: getAuthEndpointSetupSectionMock,
  getControlPlaneSchemaSetupSection: getControlPlaneSchemaSetupSectionMock,
  getDatabaseConnectionSetupSections: getDatabaseConnectionSetupSectionsMock,
  getInstallSetupStatus: getInstallSetupStatusMock,
  isInstallSetupReady: isInstallSetupReadyMock,
}));

import { POST } from "@/app/api/setup/check/route";

describe("setup check route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getControlPlaneSchemaSetupSectionMock.mockResolvedValue({
      checks: [],
      description: "Required database setup for BaseBuddy.",
      status: "ready",
      title: "BaseBuddy tables",
    });
    getAuthEndpointSetupSectionMock.mockResolvedValue({
      checks: [],
      description: "Checks that Supabase Auth is reachable for sign-in.",
      status: "ready",
      title: "Auth endpoint",
    });
    getDatabaseConnectionSetupSectionsMock.mockResolvedValue([
      {
        checks: [],
        description: "Checks that BaseBuddy can connect to this Postgres database.",
        status: "ready",
        title: "Database",
      },
    ]);
    getInstallSetupStatusMock.mockReturnValue({
      sections: [
        {
          checks: [
            {
              key: "BASEBUDDY_SUPABASE_SECRET_KEY",
              label: "Server key",
              required: true,
              status: "ready",
              value: "set:abcd1234",
            },
          ],
          description: "App configuration required for this self-host install.",
          status: "ready",
          title: "App configuration",
        },
      ],
      topology: "unified",
    });
    isInstallSetupReadyMock.mockReturnValue(true);
  });

  it("returns only setup readiness after setup is complete", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup/check", {
        body: "{}",
        method: "POST",
      }),
    );

    const body = await response.json();

    expect(body).toEqual({
      ready: true,
    });
    expect(enforceRateLimitMock).toHaveBeenCalledWith({
      bucket: "api:setup-check",
      key: "setup",
      limit: 20,
      request: expect.any(Request),
      windowMs: 60_000,
    });
    expect(getInstallSetupStatusMock).toHaveBeenCalledWith({
      additionalSections: [
        expect.objectContaining({ title: "Auth endpoint" }),
        expect.objectContaining({ title: "Database" }),
      ],
      controlPlaneSchemaSection: expect.objectContaining({
        title: "BaseBuddy tables",
      }),
    });
    expect(JSON.stringify(body)).not.toContain("secret-key");
    expect(JSON.stringify(body)).not.toContain("BASEBUDDY_SUPABASE_SECRET_KEY");
  });

  it("returns diagnostics while setup is incomplete", async () => {
    isInstallSetupReadyMock.mockReturnValueOnce(false);

    const response = await POST(
      new Request("http://localhost/api/setup/check", {
        body: "{}",
        method: "POST",
      }),
    );

    const body = await response.json();

    expect(body).toEqual({
      ready: false,
      status: {
        sections: [
          {
            checks: [
              {
                key: "BASEBUDDY_SUPABASE_SECRET_KEY",
                label: "Server key",
                required: true,
                status: "ready",
                value: "set:abcd1234",
              },
            ],
            description: "App configuration required for this self-host install.",
            status: "ready",
            title: "App configuration",
          },
        ],
        topology: "unified",
      },
    });
  });

  it("rate-limits setup verification", async () => {
    enforceRateLimitMock.mockReturnValueOnce(Response.json({ error: "Too many requests." }, { status: 429 }));

    const response = await POST(
      new Request("http://localhost/api/setup/check", {
        body: "{}",
        method: "POST",
      }),
    );

    expect(response.status).toBe(429);
    expect(getControlPlaneSchemaSetupSectionMock).not.toHaveBeenCalled();
  });

  it("rejects oversized setup verification bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup/check", {
        body: JSON.stringify({ value: "x".repeat(2048) }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(413);
    expect(getControlPlaneSchemaSetupSectionMock).not.toHaveBeenCalled();
  });
});
