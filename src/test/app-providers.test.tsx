import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createAppQueryClient, Providers } from "@/app/providers";

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));

describe("app providers", () => {
  it("creates a query client with calm default refetch behavior", () => {
    const queryClient = createAppQueryClient();

    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
    });
  });

  it("provides the shared query client defaults through the root providers", () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: Providers,
    });

    expect(result.current.getDefaultOptions().queries).toMatchObject({
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
    });
  });
});
