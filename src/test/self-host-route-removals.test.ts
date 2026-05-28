import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("self-host route removals", () => {
  it("keeps the hosted-era onboarding and connect routes removed", () => {
    expect(existsSync(join(repoRoot, "src/app/api/onboarding/project-details/route.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/app/api/onboarding/verify-connection/route.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/app/api/supabase/connect/route.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/app/api/supabase/connect/callback/route.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/app/api/supabase/connect/reset/route.ts"))).toBe(false);
  });

  it("keeps project creation APIs outside the onboarding namespace", () => {
    expect(existsSync(join(repoRoot, "src/app/api/onboarding"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/app/api/projects/slug-availability/route.ts"))).toBe(true);
    expect(existsSync(join(repoRoot, "src/app/api/projects/route.ts"))).toBe(true);
  });

  it("keeps legacy Supabase app-state boot modules removed", () => {
    expect(existsSync(join(repoRoot, "src/lib/control-plane/supabase-clients.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/lib/supabase/server-auth.ts"))).toBe(false);

    const proxySource = readFileSync(join(repoRoot, "proxy.ts"), "utf8");
    const nextConfigSource = readFileSync(join(repoRoot, "next.config.ts"), "utf8");

    expect(proxySource).not.toContain("src/lib/supabase");
    expect(nextConfigSource).not.toContain("src/lib/supabase");
    expect(nextConfigSource).not.toContain(["BASEBUDDY", "CONTROL", "SUPABASE"].join("_"));
  });

  it("keeps obsolete install-runtime compatibility wrappers removed", () => {
    expect(existsSync(join(repoRoot, "src/lib/self-host/install-env.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/lib/self-host/install-runtime.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/lib/self-host/install-runtime-validation.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/lib/self-host/auth-providers.ts"))).toBe(false);
    expect(existsSync(join(repoRoot, "src/lib/self-host/auth-provider-options.ts"))).toBe(false);
  });

  it("keeps onboarding free of migration-first setup props", () => {
    const onboardingSource = readFileSync(
      join(repoRoot, "src/components/projects/onboarding-setup-view.tsx"),
      "utf8",
    );

    expect(onboardingSource).not.toContain("migrationSql");
    expect(onboardingSource).not.toContain("setup SQL");
  });
});
