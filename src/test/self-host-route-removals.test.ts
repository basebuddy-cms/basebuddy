import { existsSync } from "node:fs";
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
});
