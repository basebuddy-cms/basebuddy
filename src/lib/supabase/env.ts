import { normalizeEnvValue } from "../env/placeholders";

export const getSupabaseUrl = () => {
  const value =
    normalizeEnvValue(process.env.BASEBUDDY_CONTROL_SUPABASE_URL) ??
    normalizeEnvValue(process.env.BASEBUDDY_SUPABASE_URL);

  if (!value) {
    throw new Error(
      "Missing required environment variable: BASEBUDDY_CONTROL_SUPABASE_URL or BASEBUDDY_SUPABASE_URL",
    );
  }

  return value;
};

export const getSupabasePublishableKey = () => {
  const value =
    normalizeEnvValue(process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY) ??
    normalizeEnvValue(process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY);

  if (!value) {
    throw new Error(
      "Missing required environment variable: BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY or BASEBUDDY_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return value;
};

export const getOptionalSupabaseUrl = () =>
  normalizeEnvValue(process.env.BASEBUDDY_CONTROL_SUPABASE_URL) ??
  normalizeEnvValue(process.env.BASEBUDDY_SUPABASE_URL);

export const getOptionalSupabasePublishableKey = () =>
  normalizeEnvValue(process.env.BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY) ??
  normalizeEnvValue(process.env.BASEBUDDY_SUPABASE_PUBLISHABLE_KEY);

export const getSupabaseServiceRoleKey = () => {
  const value =
    normalizeEnvValue(process.env.BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY) ??
    normalizeEnvValue(process.env.BASEBUDDY_SUPABASE_SECRET_KEY);

  if (!value) {
    throw new Error(
      "Missing required environment variable: BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY or BASEBUDDY_SUPABASE_SECRET_KEY",
    );
  }

  return value;
};
