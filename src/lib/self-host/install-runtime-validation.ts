import { getSupabasePublishableKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../supabase/env";
import { getInstallAuthProviders } from "./auth-providers";
import {
  getInstallEnvMode,
  getInstallContentDatabaseUrl,
  getInstallContentSupabasePublishableKey,
  getInstallContentSupabaseSecretKey,
  getInstallContentSupabaseUrl,
  getInstallControlPlaneDatabaseUrl,
  getInstallRuntimeTopology,
  readOptionalInstallEnv,
} from "./install-env";

const getConfiguredUrlKeys = () => {
  const mode = getInstallEnvMode();

  if (mode === "same-project" || mode === "missing") {
    return {
      databaseUrlKeys: ["BASEBUDDY_DATABASE_URL"],
      supabaseUrlKeys: ["BASEBUDDY_SUPABASE_URL"],
    };
  }

  return {
    databaseUrlKeys: ["BASEBUDDY_CONTROL_DATABASE_URL", "BASEBUDDY_CONTENT_DATABASE_URL"],
    supabaseUrlKeys: ["BASEBUDDY_CONTROL_SUPABASE_URL", "BASEBUDDY_CONTENT_SUPABASE_URL"],
  };
};

const validateSupabaseUrl = (key: string, value: string) => {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      throw new Error("invalid");
    }
  } catch {
    throw new Error(`Invalid Supabase URL in ${key}.`);
  }
};

const validateDatabaseUrl = (key: string, value: string) => {
  try {
    const url = new URL(value);

    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error("invalid");
    }
  } catch {
    throw new Error(`Invalid database URL in ${key}.`);
  }
};

const validateConfiguredUrls = () => {
  const { databaseUrlKeys, supabaseUrlKeys } = getConfiguredUrlKeys();

  for (const key of supabaseUrlKeys) {
    const value = readOptionalInstallEnv(key);

    if (value) {
      validateSupabaseUrl(key, value);
    }
  }

  for (const key of databaseUrlKeys) {
    const value = readOptionalInstallEnv(key);

    if (value) {
      validateDatabaseUrl(key, value);
    }
  }
};

const validateS3CompatibleStorageCredentialPair = ({
  accessKeyIdKey,
  secretAccessKeyKey,
}: {
  accessKeyIdKey: string;
  secretAccessKeyKey: string;
}) => {
  const accessKeyId = readOptionalInstallEnv(accessKeyIdKey);
  const secretAccessKey = readOptionalInstallEnv(secretAccessKeyKey);

  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    throw new Error(
      `Incomplete S3 storage env configuration: set both ${accessKeyIdKey} and ${secretAccessKeyKey}.`,
    );
  }
};

export const validateInstallStorageConfiguration = () => {
  validateS3CompatibleStorageCredentialPair({
    accessKeyIdKey: "BASEBUDDY_S3_ACCESS_KEY_ID",
    secretAccessKeyKey: "BASEBUDDY_S3_SECRET_ACCESS_KEY",
  });
  validateS3CompatibleStorageCredentialPair({
    accessKeyIdKey: "BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID",
    secretAccessKeyKey: "BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY",
  });
  validateS3CompatibleStorageCredentialPair({
    accessKeyIdKey: "BASEBUDDY_FILES_S3_ACCESS_KEY_ID",
    secretAccessKeyKey: "BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY",
  });
};

export const validateInstallRuntimeConfiguration = () => {
  getInstallRuntimeTopology();
  getSupabaseUrl();
  getSupabasePublishableKey();
  getSupabaseServiceRoleKey();
  getInstallControlPlaneDatabaseUrl();
  getInstallContentSupabaseUrl();
  getInstallContentSupabasePublishableKey();
  getInstallContentSupabaseSecretKey();
  getInstallContentDatabaseUrl();
  getInstallAuthProviders();
  validateConfiguredUrls();

  validateInstallStorageConfiguration();
};
