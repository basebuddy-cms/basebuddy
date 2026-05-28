import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

import {
  ensureContentStorageConnection,
  getUniqueContentFolderPath,
  getUniqueContentObjectPath,
} from "@/lib/content-runtime/server-media-shared";

const createContext = (
  overrides: Partial<Parameters<typeof ensureContentStorageConnection>[0]> = {},
): Parameters<typeof ensureContentStorageConnection>[0] => ({
  apiUrl: "https://install.supabase.co",
  connectionString: null,
  memberAccess: {
    authorScopes: [],
    permissions: [],
    roles: ["owner"],
  },
  projectId: "project-1",
  projectSlug: "demo",
  publishableKey: "sb_publishable_test",
  schemaOptions: {
    enableRevisions: false,
    enableRls: true,
    primaryContentFormat: "html",
  },
  user: {
    id: "user-1",
  } as Parameters<typeof ensureContentStorageConnection>[0]["user"],
  ...overrides,
});

describe("server media shared helpers", () => {
  it("uses self-host mapped content wording when connection setup is incomplete", () => {
    expect(() =>
      ensureContentStorageConnection(createContext()),
    ).toThrow("This project needs a working database connection before you can continue.");
  });

  it("keeps generated upload object paths inside the selected folder", () => {
    expect(
      getUniqueContentObjectPath(
        new Set(),
        "media/uploads",
        "../private/../../avatar.png",
      ),
    ).toBe("media/uploads/avatar.png");
  });

  it("keeps generated folder paths inside the selected parent", () => {
    expect(
      getUniqueContentFolderPath(
        new Set(),
        "media",
        "../private",
      ),
    ).toBe("media/private");
  });
});
