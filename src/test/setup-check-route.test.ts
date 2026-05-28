import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enforceRateLimitMock,
  getBaseBuddyConfigSetupStatusMock,
  isBaseBuddyConfigSetupReadyMock,
} = vi.hoisted(() => ({
  enforceRateLimitMock: vi.fn(() => null),
  getBaseBuddyConfigSetupStatusMock: vi.fn(),
  isBaseBuddyConfigSetupReadyMock: vi.fn(),
}));

vi.mock("@/lib/api/request-guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/request-guards")>();

  return {
    ...actual,
    enforceRateLimit: enforceRateLimitMock,
  };
});

vi.mock("@/lib/basebuddy-config/setup", () => ({
  getBaseBuddyConfigSetupStatus: getBaseBuddyConfigSetupStatusMock,
  isBaseBuddyConfigSetupReady: isBaseBuddyConfigSetupReadyMock,
}));

import { POST } from "@/app/api/setup/check/route";

describe("setup check route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseBuddyConfigSetupStatusMock.mockResolvedValue({
      configPath: "/repo/basebuddy.config.json",
      sections: [
        {
          checks: [
            {
              key: "BASEBUDDY_AUTH_SECRET",
              label: "Auth secret",
              required: true,
              status: "ready",
              value: "set:abcd1234",
            },
          ],
          description: "Local config file readiness.",
          status: "ready",
          title: "Environment values",
        },
      ],
      topology: "config-file",
    });
    isBaseBuddyConfigSetupReadyMock.mockReturnValue(true);
  });

  it("returns setup readiness and redacted status after setup is complete", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup/check", {
        body: "{}",
        method: "POST",
      }),
    );

    const body = await response.json();

    expect(body).toEqual({
      ready: true,
      status: {
        configPath: "/repo/basebuddy.config.json",
        sections: [
          {
            checks: [
              {
                key: "BASEBUDDY_AUTH_SECRET",
                label: "Auth secret",
                required: true,
                status: "ready",
                value: "set:abcd1234",
              },
            ],
            description: "Local config file readiness.",
            status: "ready",
            title: "Environment values",
          },
        ],
        topology: "config-file",
      },
    });
    expect(enforceRateLimitMock).toHaveBeenCalledWith({
      bucket: "api:setup-check",
      key: "setup",
      limit: 20,
      request: expect.any(Request),
      windowMs: 60_000,
    });
    expect(getBaseBuddyConfigSetupStatusMock).toHaveBeenCalledWith({
      checkContentDatabase: true,
    });
    expect(JSON.stringify(body)).not.toContain("secret-key");
    expect(JSON.stringify(body)).not.toContain("authSecret");
  });

  it("returns diagnostics while setup is incomplete", async () => {
    isBaseBuddyConfigSetupReadyMock.mockReturnValueOnce(false);

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
        configPath: "/repo/basebuddy.config.json",
        sections: [
          {
            checks: [
              {
                key: "BASEBUDDY_AUTH_SECRET",
                label: "Auth secret",
                required: true,
                status: "ready",
                value: "set:abcd1234",
              },
            ],
            description: "Local config file readiness.",
            status: "ready",
            title: "Environment values",
          },
        ],
        topology: "config-file",
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
    expect(getBaseBuddyConfigSetupStatusMock).not.toHaveBeenCalled();
  });

  it("rejects oversized setup verification bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup/check", {
        body: JSON.stringify({ value: "x".repeat(2048) }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(413);
    expect(getBaseBuddyConfigSetupStatusMock).not.toHaveBeenCalled();
  });
});
