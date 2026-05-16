import { normalizeEnvValue } from "../env/placeholders";
import {
  getSupabasePublishableKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "../supabase/env";

export type InstallRuntimeTopology = "split" | "unified";
export type InstallEnvMode = "missing" | "mixed" | "same-project" | "split-project";

export type InstallPlaneEnv = {
  databaseUrl: string | null;
  publishableKey: string | null;
  secretKey: string | null;
  supabaseUrl: string | null;
};

export const CANONICAL_INSTALL_PLANE_ENV_KEYS = [
  "BASEBUDDY_CONTROL_DATABASE_URL",
  "BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY",
  "BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY",
  "BASEBUDDY_CONTROL_SUPABASE_URL",
  "BASEBUDDY_CONTENT_DATABASE_URL",
  "BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY",
  "BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY",
  "BASEBUDDY_CONTENT_SUPABASE_URL",
] as const;

export const SAME_PROJECT_INSTALL_ENV_KEYS = [
  "BASEBUDDY_DATABASE_URL",
  "BASEBUDDY_SUPABASE_PUBLISHABLE_KEY",
  "BASEBUDDY_SUPABASE_SECRET_KEY",
  "BASEBUDDY_SUPABASE_URL",
] as const;

export const readOptionalInstallEnv = (key: string) => normalizeEnvValue(process.env[key]);

export const hasCanonicalPlaneEnv = () =>
  CANONICAL_INSTALL_PLANE_ENV_KEYS.some((key) => Boolean(readOptionalInstallEnv(key)));

export const hasSameProjectEnv = () =>
  SAME_PROJECT_INSTALL_ENV_KEYS.some((key) => Boolean(readOptionalInstallEnv(key)));

export const getInstallEnvMode = (): InstallEnvMode => {
  const hasSplitProjectValues = hasCanonicalPlaneEnv();
  const hasSameProjectValues = hasSameProjectEnv();

  if (hasSplitProjectValues && hasSameProjectValues) {
    return "mixed";
  }

  if (hasSameProjectValues) {
    return "same-project";
  }

  if (hasSplitProjectValues) {
    return "split-project";
  }

  return "missing";
};

export const assertSupportedInstallEnvMode = () => {
  if (getInstallEnvMode() === "mixed") {
    throw new Error(
      "Use either the same-project env names or the split-project env names, not both.",
    );
  }
};

export const getFirstDefinedInstallEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = readOptionalInstallEnv(key);

    if (value) {
      return value;
    }
  }

  return null;
};

export const getInstallSameProjectEnv = (): InstallPlaneEnv => ({
  databaseUrl: readOptionalInstallEnv("BASEBUDDY_DATABASE_URL"),
  publishableKey: readOptionalInstallEnv("BASEBUDDY_SUPABASE_PUBLISHABLE_KEY"),
  secretKey: readOptionalInstallEnv("BASEBUDDY_SUPABASE_SECRET_KEY"),
  supabaseUrl: readOptionalInstallEnv("BASEBUDDY_SUPABASE_URL"),
});

export const getInstallControlPlaneEnv = (): InstallPlaneEnv => ({
  databaseUrl:
    readOptionalInstallEnv("BASEBUDDY_CONTROL_DATABASE_URL") ??
    readOptionalInstallEnv("BASEBUDDY_DATABASE_URL"),
  publishableKey:
    readOptionalInstallEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_PUBLISHABLE_KEY"),
  secretKey:
    readOptionalInstallEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_SECRET_KEY"),
  supabaseUrl:
    readOptionalInstallEnv("BASEBUDDY_CONTROL_SUPABASE_URL") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_URL"),
});

export const getInstallContentPlaneEnv = (): InstallPlaneEnv => ({
  databaseUrl:
    readOptionalInstallEnv("BASEBUDDY_CONTENT_DATABASE_URL") ??
    readOptionalInstallEnv("BASEBUDDY_DATABASE_URL"),
  publishableKey:
    readOptionalInstallEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_PUBLISHABLE_KEY"),
  secretKey:
    readOptionalInstallEnv("BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_SECRET_KEY"),
  supabaseUrl:
    readOptionalInstallEnv("BASEBUDDY_CONTENT_SUPABASE_URL") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_URL"),
});

export const getInstallRuntimeTopology = (): InstallRuntimeTopology => {
  assertSupportedInstallEnvMode();

  const rawValue = readOptionalInstallEnv("BASEBUDDY_RUNTIME_TOPOLOGY");

  if (rawValue === "unified" || rawValue === "split") {
    return rawValue;
  }

  if (rawValue) {
    throw new Error("BASEBUDDY_RUNTIME_TOPOLOGY must be either unified or split.");
  }

  const controlEnv = getInstallControlPlaneEnv();
  const contentEnv = getInstallContentPlaneEnv();
  const controlValues = [
    controlEnv.databaseUrl,
    controlEnv.supabaseUrl,
    controlEnv.publishableKey,
    controlEnv.secretKey,
  ];
  const contentValues = [
    contentEnv.databaseUrl,
    contentEnv.supabaseUrl,
    contentEnv.publishableKey,
    contentEnv.secretKey,
  ];

  return contentValues.some((value, index) => value && value !== controlValues[index])
    ? "split"
    : "unified";
};

export const getInstallControlPlaneDatabaseUrl = () => {
  const value = getInstallControlPlaneEnv().databaseUrl;

  if (!value) {
    throw new Error("Missing required environment variable: BASEBUDDY_CONTROL_DATABASE_URL");
  }

  return value;
};

export const getInstallContentDatabaseUrl = () => {
  const value = getInstallContentPlaneEnv().databaseUrl;

  if (value) {
    return value;
  }

  if (getInstallRuntimeTopology() === "split" || hasCanonicalPlaneEnv()) {
    throw new Error("Missing required environment variable: BASEBUDDY_CONTENT_DATABASE_URL");
  }

  return getInstallControlPlaneDatabaseUrl();
};

export const getInstallContentSupabaseUrl = () => {
  const value = getInstallContentPlaneEnv().supabaseUrl;

  if (value) {
    return value;
  }

  if (hasCanonicalPlaneEnv()) {
    throw new Error("Missing required environment variable: BASEBUDDY_CONTENT_SUPABASE_URL");
  }

  return getSupabaseUrl();
};

export const getInstallContentSupabasePublishableKey = () => {
  const value = getInstallContentPlaneEnv().publishableKey;

  if (value) {
    return value;
  }

  if (hasCanonicalPlaneEnv()) {
    throw new Error(
      "Missing required environment variable: BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return getSupabasePublishableKey();
};

export const getInstallContentSupabaseSecretKey = () => {
  const value = getInstallContentPlaneEnv().secretKey;

  if (value) {
    return value;
  }

  if (hasCanonicalPlaneEnv()) {
    throw new Error("Missing required environment variable: BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY");
  }

  return getSupabaseServiceRoleKey();
};
