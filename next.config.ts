import type { NextConfig } from "next";
import { getOptionalSupabaseUrl } from "./src/lib/supabase/env";
import { isSearchIndexingEnabled } from "./src/lib/site-indexing";
import { getSecurityHeaders } from "./src/lib/security/headers";
import { normalizeEnvValue } from "./src/lib/env/placeholders";

const isProduction = process.env.NODE_ENV === "production";
const searchIndexingEnabled = isSearchIndexingEnabled(process.env.NEXT_PUBLIC_SITE_INDEXABLE);
const securityHeaders = getSecurityHeaders({
  includeContentSecurityPolicy: false,
  isProduction,
  searchIndexingEnabled,
  supabaseUrl: getOptionalSupabaseUrl(),
});
const browserSupabaseUrl = normalizeEnvValue(process.env.BASEBUDDY_CONTROL_SUPABASE_URL);
const browserSupabasePublishableKey = normalizeEnvValue(
  process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY,
);
const browserEnv = {
  ...(browserSupabasePublishableKey
    ? { BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY: browserSupabasePublishableKey }
    : {}),
  ...(browserSupabaseUrl ? { BASEBUDDY_CONTROL_SUPABASE_URL: browserSupabaseUrl } : {}),
};

const nextConfig: NextConfig = {
  env: browserEnv,
  poweredByHeader: false,
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: "/:path*",
      },
    ];
  },
};

export default nextConfig;
