import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { dirname } from "node:path";
import { Pool } from "pg";

import {
  BASEBUDDY_AUTH_SECRET_ENV,
  BASEBUDDY_CONTENT_DATABASE_URL_ENV,
  BASEBUDDY_S3_ACCESS_KEY_ID_ENV,
  BASEBUDDY_S3_SECRET_ACCESS_KEY_ENV,
  BASEBUDDY_SUPABASE_PUBLISHABLE_KEY_ENV,
  BASEBUDDY_SUPABASE_SECRET_KEY_ENV,
  BASEBUDDY_SUPABASE_URL_ENV,
  readBaseBuddyRuntimeEnv,
  redactEnvCredentialValue,
} from "./env";
import { getBaseBuddyConfigPath } from "./paths";
import { loadOptionalBaseBuddyConfig, getRedactedBaseBuddyConfigStatus } from "./store";

export type BaseBuddyConfigSetupCheckStatus = "ready" | "missing" | "invalid";

export type BaseBuddyConfigSetupCheck = {
  key: string;
  label: string;
  required: boolean;
  status: BaseBuddyConfigSetupCheckStatus;
  value: string | null;
};

export type BaseBuddyConfigSetupSection = {
  checks: BaseBuddyConfigSetupCheck[];
  description: string;
  status: BaseBuddyConfigSetupCheckStatus;
  title: string;
};

export type BaseBuddyConfigSetupStatus = {
  configPath: string;
  sections: BaseBuddyConfigSetupSection[];
  topology: "config-file" | "invalid";
};

type BaseBuddyConfigSetupDependencies = {
  checkContentDatabase?: boolean;
  queryDatabase?: (connectionString: string) => Promise<void>;
};

export const BASEBUDDY_SETUP_REQUIRED_MESSAGE =
  "BaseBuddy setup is incomplete. Open setup to review environment values, the owner account, the config file, and the database connection.";

const canAccess = async (path: string, mode: number) => {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
};

const getSectionStatus = (
  checks: BaseBuddyConfigSetupCheck[],
): BaseBuddyConfigSetupCheckStatus =>
  checks.some((check) => check.status === "invalid")
    ? "invalid"
    : checks.some((check) => check.status === "missing")
      ? "missing"
      : "ready";

const createCheck = ({
  key,
  label,
  required = true,
  status,
  value,
}: {
  key: string;
  label: string;
  required?: boolean;
  status: BaseBuddyConfigSetupCheckStatus;
  value: string | null;
}): BaseBuddyConfigSetupCheck => ({
  key,
  label,
  required,
  status,
  value,
});

const getContentDatabaseSslConfig = (connectionString: string) => {
  try {
    const url = new URL(connectionString);

    if (url.searchParams.get("sslmode")?.toLowerCase() === "disable") {
      return false;
    }
  } catch {
    return {
      rejectUnauthorized: false,
    };
  }

  return {
    rejectUnauthorized: false,
  };
};

export const queryBaseBuddyContentDatabase = async (connectionString: string) => {
  const pool = new Pool({
    allowExitOnIdle: true,
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 1_000,
    max: 1,
    query_timeout: 5_000,
    ssl: getContentDatabaseSslConfig(connectionString),
    statement_timeout: 5_000,
  });

  try {
    await pool.query("select 1");
  } finally {
    await pool.end();
  }
};

export const getBaseBuddyConfigSetupStatus = async ({
  checkContentDatabase = false,
  queryDatabase = queryBaseBuddyContentDatabase,
}: BaseBuddyConfigSetupDependencies = {}): Promise<BaseBuddyConfigSetupStatus> => {
  const configPath = getBaseBuddyConfigPath();
  const redactedStatus = await getRedactedBaseBuddyConfigStatus();
  const configFileWritable = redactedStatus.config.exists
    ? redactedStatus.config.writable
    : await canAccess(dirname(configPath), constants.W_OK);
  const config = redactedStatus.config.valid ? await loadOptionalBaseBuddyConfig() : null;
  const runtimeEnv = readBaseBuddyRuntimeEnv();
  const databaseUrl = runtimeEnv.contentDatabaseUrl;
  const redactedDatabaseUrl = redactEnvCredentialValue({
    key: BASEBUDDY_CONTENT_DATABASE_URL_ENV,
    value: databaseUrl,
  });
  const configChecks: BaseBuddyConfigSetupCheck[] = [
    createCheck({
      key: "basebuddy.config.exists",
      label: "Config file exists",
      status: redactedStatus.config.exists ? "ready" : "missing",
      value: configPath,
    }),
    createCheck({
      key: "basebuddy.config.readable",
      label: "Config file readable",
      status: redactedStatus.config.exists
        ? redactedStatus.config.readable
          ? "ready"
          : "invalid"
        : "missing",
      value: redactedStatus.config.exists ? configPath : "Create basebuddy.config.json.",
    }),
    createCheck({
      key: "basebuddy.config.writable",
      label: "Config path writable",
      status: configFileWritable ? "ready" : "invalid",
      value: configFileWritable ? configPath : "BaseBuddy cannot write this config path.",
    }),
    createCheck({
      key: "basebuddy.config.valid",
      label: "Config file validates",
      status: redactedStatus.config.exists
        ? redactedStatus.config.valid
          ? "ready"
          : "invalid"
        : "missing",
      value: redactedStatus.config.exists
        ? redactedStatus.config.error ?? "valid"
        : "Create basebuddy.config.json.",
    }),
  ];
  const ownerChecks: BaseBuddyConfigSetupCheck[] = [
    createCheck({
      key: "basebuddy.config.ownerUser",
      label: "Owner user exists",
      status: config && config.users.length > 0 ? "ready" : "missing",
      value: config && config.users.length > 0
        ? `${config.users.length} local user${config.users.length === 1 ? "" : "s"}`
        : "Create the first owner user.",
    }),
  ];
  const environmentChecks: BaseBuddyConfigSetupCheck[] = [
    createCheck({
      key: BASEBUDDY_AUTH_SECRET_ENV,
      label: "Auth secret exists",
      status: runtimeEnv.authSecret
        ? runtimeEnv.authSecret.length >= 32
          ? "ready"
          : "invalid"
        : "missing",
      value: runtimeEnv.authSecret
        ? redactEnvCredentialValue({
            key: BASEBUDDY_AUTH_SECRET_ENV,
            value: runtimeEnv.authSecret,
          })
        : `Set ${BASEBUDDY_AUTH_SECRET_ENV}.`,
    }),
    createCheck({
      key: BASEBUDDY_CONTENT_DATABASE_URL_ENV,
      label: "Database URL exists",
      status: databaseUrl ? "ready" : "missing",
      value: databaseUrl ? redactedDatabaseUrl : `Set ${BASEBUDDY_CONTENT_DATABASE_URL_ENV}.`,
    }),
  ];
  const databaseConnectionChecks: BaseBuddyConfigSetupCheck[] = [];

  if (!databaseUrl) {
    databaseConnectionChecks.push(
      createCheck({
        key: "BASEBUDDY_CONTENT_DATABASE_URL.reachable",
        label: "Database reachable",
        status: "missing",
        value: `Set ${BASEBUDDY_CONTENT_DATABASE_URL_ENV} first.`,
      }),
    );
  } else if (!checkContentDatabase) {
    databaseConnectionChecks.push(
      createCheck({
        key: "BASEBUDDY_CONTENT_DATABASE_URL.reachable",
        label: "Database reachable",
        status: "ready",
        value: "Automatic setup checks verify reachability.",
      }),
    );
  } else {
    try {
      await queryDatabase(databaseUrl);
      databaseConnectionChecks.push(
        createCheck({
          key: "BASEBUDDY_CONTENT_DATABASE_URL.reachable",
          label: "Database reachable",
          status: "ready",
          value: redactedDatabaseUrl,
        }),
      );
    } catch {
      databaseConnectionChecks.push(
        createCheck({
          key: "BASEBUDDY_CONTENT_DATABASE_URL.reachable",
          label: "Database reachable",
          status: "invalid",
          value: "Could not connect with this database URL.",
        }),
      );
    }
  }

  const supabaseStorageValues = [
    runtimeEnv.contentSupabaseUrl,
    runtimeEnv.contentSupabasePublishableKey,
    runtimeEnv.contentSupabaseSecretKey,
  ];
  const hasSupabaseStorageConfig = supabaseStorageValues.some(Boolean);
  const supabaseStorageChecks: BaseBuddyConfigSetupCheck[] = hasSupabaseStorageConfig
    ? [
        createCheck({
          key: BASEBUDDY_SUPABASE_URL_ENV,
          label: "Supabase URL",
          required: false,
          status: runtimeEnv.contentSupabaseUrl ? "ready" : "invalid",
          value: runtimeEnv.contentSupabaseUrl ?? `Set ${BASEBUDDY_SUPABASE_URL_ENV}.`,
        }),
        createCheck({
          key: BASEBUDDY_SUPABASE_PUBLISHABLE_KEY_ENV,
          label: "Supabase publishable key",
          required: false,
          status: runtimeEnv.contentSupabasePublishableKey ? "ready" : "invalid",
          value: runtimeEnv.contentSupabasePublishableKey
            ? redactEnvCredentialValue({
                key: BASEBUDDY_SUPABASE_PUBLISHABLE_KEY_ENV,
                value: runtimeEnv.contentSupabasePublishableKey,
              })
            : `Set ${BASEBUDDY_SUPABASE_PUBLISHABLE_KEY_ENV}.`,
        }),
        createCheck({
          key: BASEBUDDY_SUPABASE_SECRET_KEY_ENV,
          label: "Supabase server key",
          required: false,
          status: runtimeEnv.contentSupabaseSecretKey ? "ready" : "invalid",
          value: runtimeEnv.contentSupabaseSecretKey
            ? redactEnvCredentialValue({
                key: BASEBUDDY_SUPABASE_SECRET_KEY_ENV,
                value: runtimeEnv.contentSupabaseSecretKey,
              })
            : `Set ${BASEBUDDY_SUPABASE_SECRET_KEY_ENV}.`,
        }),
      ]
    : [
        createCheck({
          key: "BASEBUDDY_SUPABASE_STORAGE",
          label: "Supabase storage",
          required: false,
          status: "ready",
          value: "Only needed for images and files.",
        }),
      ];
  const hasS3Config = Boolean(runtimeEnv.s3AccessKeyId || runtimeEnv.s3SecretAccessKey);
  const s3StorageChecks: BaseBuddyConfigSetupCheck[] = hasS3Config
    ? [
        createCheck({
          key: BASEBUDDY_S3_ACCESS_KEY_ID_ENV,
          label: "S3 access key",
          required: false,
          status: runtimeEnv.s3AccessKeyId ? "ready" : "invalid",
          value: runtimeEnv.s3AccessKeyId
            ? redactEnvCredentialValue({
                key: BASEBUDDY_S3_ACCESS_KEY_ID_ENV,
                value: runtimeEnv.s3AccessKeyId,
              })
            : `Set ${BASEBUDDY_S3_ACCESS_KEY_ID_ENV}.`,
        }),
        createCheck({
          key: BASEBUDDY_S3_SECRET_ACCESS_KEY_ENV,
          label: "S3 secret key",
          required: false,
          status: runtimeEnv.s3SecretAccessKey ? "ready" : "invalid",
          value: runtimeEnv.s3SecretAccessKey
            ? redactEnvCredentialValue({
                key: BASEBUDDY_S3_SECRET_ACCESS_KEY_ENV,
                value: runtimeEnv.s3SecretAccessKey,
              })
            : `Set ${BASEBUDDY_S3_SECRET_ACCESS_KEY_ENV}.`,
        }),
      ]
    : [
        createCheck({
          key: "BASEBUDDY_S3_CREDENTIALS",
          label: "S3-compatible storage",
          required: false,
          status: "ready",
          value: "Not configured.",
        }),
      ];

  const sections: BaseBuddyConfigSetupSection[] = [
    {
      checks: configChecks,
      description: "The root BaseBuddy config file at process.cwd()/basebuddy.config.json.",
      status: getSectionStatus(configChecks),
      title: "Config file",
    },
    {
      checks: ownerChecks,
      description: "The first local user for this BaseBuddy install.",
      status: getSectionStatus(ownerChecks),
      title: "Owner account",
    },
    {
      checks: environmentChecks,
      description: "Required environment values for sessions and database access.",
      status: getSectionStatus(environmentChecks),
      title: "Environment values",
    },
    {
      checks: databaseConnectionChecks,
      description: "BaseBuddy can reach the configured Postgres database.",
      status: getSectionStatus(databaseConnectionChecks),
      title: "Database connection",
    },
    {
      checks: supabaseStorageChecks,
      description: "Supabase credentials for images and files.",
      status: getSectionStatus(supabaseStorageChecks),
      title: "Supabase storage",
    },
    {
      checks: s3StorageChecks,
      description: "Optional shared S3-compatible upload credentials for mapped media and files.",
      status: getSectionStatus(s3StorageChecks),
      title: "S3-compatible storage",
    },
  ];

  return {
    configPath,
    sections,
    topology: redactedStatus.config.valid || !redactedStatus.config.exists ? "config-file" : "invalid",
  };
};

export const isBaseBuddyConfigSetupReady = (status: BaseBuddyConfigSetupStatus) =>
  status.sections.every((section) =>
    section.checks
      .filter((check) => check.required)
      .every((check) => check.status === "ready"),
  );

export const getBaseBuddyConfigSetupReadiness = async (
  dependencies?: BaseBuddyConfigSetupDependencies,
) => {
  const status = await getBaseBuddyConfigSetupStatus(dependencies);

  return {
    ready: isBaseBuddyConfigSetupReady(status),
    status,
  };
};
