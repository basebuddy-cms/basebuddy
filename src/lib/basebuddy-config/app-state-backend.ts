export const BASEBUDDY_APP_STATE_BACKEND_ENV = "BASEBUDDY_APP_STATE_BACKEND";
export const BASEBUDDY_APP_STATE_DATABASE_URL_ENV = "BASEBUDDY_APP_STATE_DATABASE_URL";
const BASEBUDDY_CONTENT_DATABASE_URL_ENV = "BASEBUDDY_CONTENT_DATABASE_URL";

export const BASEBUDDY_APP_STATE_BACKEND_VALUES = [
  "basebuddy-data",
  "supabase-same-project",
  "supabase-split-project",
] as const;

export type BaseBuddyAppStateBackend =
  (typeof BASEBUDDY_APP_STATE_BACKEND_VALUES)[number];

const appStateBackendSet = new Set<string>(BASEBUDDY_APP_STATE_BACKEND_VALUES);

const normalizeEnvValue = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue || null;
};

export const getBaseBuddyAppStateBackend = (
  env: Record<string, string | undefined> = process.env,
): BaseBuddyAppStateBackend => {
  const backend = normalizeEnvValue(env[BASEBUDDY_APP_STATE_BACKEND_ENV]) ?? "basebuddy-data";

  if (!appStateBackendSet.has(backend)) {
    throw new Error(
      `${BASEBUDDY_APP_STATE_BACKEND_ENV} must be one of: ${BASEBUDDY_APP_STATE_BACKEND_VALUES.join(
        ", ",
      )}.`,
    );
  }

  return backend as BaseBuddyAppStateBackend;
};

export const getBaseBuddyAppStateDatabaseUrl = (
  env: Record<string, string | undefined> = process.env,
) => {
  const backend = getBaseBuddyAppStateBackend(env);

  if (backend === "basebuddy-data") {
    return null;
  }

  if (backend === "supabase-same-project") {
    return normalizeEnvValue(env[BASEBUDDY_CONTENT_DATABASE_URL_ENV]);
  }

  return normalizeEnvValue(env[BASEBUDDY_APP_STATE_DATABASE_URL_ENV]);
};
