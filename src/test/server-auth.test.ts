import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

describe("server auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("exchanges an auth callback code with the server client", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: null,
    });
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          email: "owner@example.com",
          id: "user-1",
          user_metadata: {},
        },
      },
    });
    const upsert = vi.fn().mockResolvedValue({
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        getUser,
      },
      from: vi.fn(() => ({
        upsert,
      })),
    } as never);

    const { exchangeServerAuthCode } = await import("@/lib/supabase/server-auth");

    await expect(exchangeServerAuthCode("code-123")).resolves.toEqual({
      ok: true,
    });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-123");
    expect(upsert).toHaveBeenCalledWith(
      {
        email: "owner@example.com",
        id: "user-1",
      },
      {
        onConflict: "id",
      },
    );
  });

  it("returns a failed callback result when profile preparation fails after session exchange", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              email: "owner@example.com",
              id: "user-1",
              user_metadata: {},
            },
          },
        }),
      },
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          error: {
            code: "500",
            message: "profile insert failed",
          },
        }),
      })),
    } as never);

    const { exchangeServerAuthCode } = await import("@/lib/supabase/server-auth");

    await expect(exchangeServerAuthCode("code-123")).resolves.toEqual({
      ok: false,
    });
  });

  it("reuses one server client for confirm flows and falls back from code exchange to otp verify", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: new Error("bad code"),
    });
    const verifyOtp = vi.fn().mockResolvedValue({
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              email: "owner@example.com",
              id: "user-1",
              user_metadata: {},
            },
          },
        }),
        verifyOtp,
      },
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          error: null,
        }),
      })),
    } as never);

    const { confirmServerAuthIdentity } = await import("@/lib/supabase/server-auth");

    await expect(
      confirmServerAuthIdentity({
        code: "code-123",
        tokenHash: "token-456",
        type: "magiclink",
      }),
    ).resolves.toEqual({
      ok: true,
    });

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-123");
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "token-456",
      type: "magiclink",
    });
  });
});
