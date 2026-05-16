const EXAMPLE_ENV_PATTERNS = [
  /^https:\/\/your-[a-z-]*project-ref\.supabase\.co$/i,
  /^sb_publishable_x+$/i,
  /^your-[a-z-]*secret-key$/i,
  /^postgresql:\/\/postgres:your-password@db\.your-[a-z-]*project-ref\.supabase\.co:5432\/postgres$/i,
];

export const normalizeEnvValue = (value: string | undefined | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return EXAMPLE_ENV_PATTERNS.some((pattern) => pattern.test(trimmed)) ? null : trimmed;
};
