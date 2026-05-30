import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BASEBUDDY_APP_STATE_BACKEND_ENV,
  BASEBUDDY_APP_STATE_DATABASE_URL_ENV,
  getBaseBuddyAppStateBackend,
  getBaseBuddyAppStateDatabaseUrl,
} from "@/lib/basebuddy-config/app-state-backend";

const contentDatabaseUrl = "postgresql://content-user:pass@example.com:5432/postgres";
const appStateDatabaseUrl = "postgresql://basebuddy-user:pass@example.com:5432/postgres";

describe("BaseBuddy app-state backend", () => {
  it("defaults to the local basebuddy-data backend", () => {
    expect(getBaseBuddyAppStateBackend({})).toBe("basebuddy-data");
    expect(getBaseBuddyAppStateDatabaseUrl({})).toBeNull();
  });

  it("uses the content database for Supabase same-project app data", () => {
    const env = {
      BASEBUDDY_CONTENT_DATABASE_URL: contentDatabaseUrl,
      [BASEBUDDY_APP_STATE_BACKEND_ENV]: "supabase-same-project",
    };

    expect(getBaseBuddyAppStateBackend(env)).toBe("supabase-same-project");
    expect(getBaseBuddyAppStateDatabaseUrl(env)).toBe(contentDatabaseUrl);
  });

  it("uses a separate database URL for Supabase split-project app data", () => {
    const env = {
      [BASEBUDDY_APP_STATE_BACKEND_ENV]: "supabase-split-project",
      [BASEBUDDY_APP_STATE_DATABASE_URL_ENV]: appStateDatabaseUrl,
    };

    expect(getBaseBuddyAppStateBackend(env)).toBe("supabase-split-project");
    expect(getBaseBuddyAppStateDatabaseUrl(env)).toBe(appStateDatabaseUrl);
  });

  it("rejects unknown backend names instead of silently choosing another store", () => {
    expect(() =>
      getBaseBuddyAppStateBackend({
        [BASEBUDDY_APP_STATE_BACKEND_ENV]: "random-db",
      }),
    ).toThrow(/BASEBUDDY_APP_STATE_BACKEND/);
  });
});
