import { normalizeEnvValue } from "../../src/lib/env/placeholders";

export const resolvePlaywrightSeedDatabaseUrl = (env: Partial<NodeJS.ProcessEnv>) =>
  normalizeEnvValue(env.BASEBUDDY_CONTENT_DATABASE_URL) || null;

export const resolvePlaywrightSeedContentSupabaseUrl = (env: Partial<NodeJS.ProcessEnv>) =>
  normalizeEnvValue(env.BASEBUDDY_SUPABASE_URL) || null;

export const resolvePlaywrightSeedContentSupabaseSecretKey = (
  env: Partial<NodeJS.ProcessEnv>,
) =>
  normalizeEnvValue(env.BASEBUDDY_SUPABASE_SECRET_KEY) || null;

export const resolvePlaywrightSeedRootCertificate = (env: Partial<NodeJS.ProcessEnv>) =>
  normalizeEnvValue(env.PLAYWRIGHT_DATABASE_ROOT_CERTIFICATE) ||
  normalizeEnvValue(env.BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE) ||
  null;

export const resolvePlaywrightSeedRootCertificateFile = (env: Partial<NodeJS.ProcessEnv>) =>
  normalizeEnvValue(env.PLAYWRIGHT_DATABASE_ROOT_CERTIFICATE_FILE) ||
  normalizeEnvValue(env.BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE_FILE) ||
  null;

export const shouldUsePlaywrightSeedDatabaseSsl = (
  env: Partial<NodeJS.ProcessEnv>,
  databaseUrl: string,
) => {
  const explicitValue = normalizeEnvValue(env.PLAYWRIGHT_DATABASE_SSL);

  if (explicitValue === "1" || explicitValue?.toLowerCase() === "true") {
    return true;
  }

  if (explicitValue === "0" || explicitValue?.toLowerCase() === "false") {
    return false;
  }

  try {
    const parsed = new URL(databaseUrl);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();

    if (sslMode === "disable") {
      return false;
    }

    if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
      return true;
    }

    return parsed.hostname.endsWith(".supabase.com");
  } catch {
    return false;
  }
};

export const resolvePlaywrightSeedProjectName = (env: Partial<NodeJS.ProcessEnv>) =>
  normalizeEnvValue(env.PLAYWRIGHT_PROJECT_NAME);

export const resolvePlaywrightSeedProjectSlug = (env: Partial<NodeJS.ProcessEnv>) =>
  normalizeEnvValue(env.PLAYWRIGHT_PROJECT_SLUG);
