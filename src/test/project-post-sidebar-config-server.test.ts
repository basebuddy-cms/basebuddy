import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/control-plane/server", () => ({
  APP_SETUP_REQUIRED_MESSAGE: "App setup is incomplete.",
  isControlPlaneSetupError: (error: { code?: string } | null | undefined) => error?.code === "PGRST202",
}));

import { getProjectPostSidebarConfig } from "@/lib/control-plane/project-post-sidebar-config";
import { createDefaultContentPostSidebarConfig } from "@/lib/content-runtime/shared";

describe("project post sidebar config server fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the default sidebar config when the sidebar RPC is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_project_content_sidebar_config(p_project_id) in the schema cache",
      },
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    await expect(getProjectPostSidebarConfig("project-1")).resolves.toEqual(
      createDefaultContentPostSidebarConfig(),
    );
  });
});
