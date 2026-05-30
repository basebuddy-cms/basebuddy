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
import { getBaseBuddyPostgresSslConfig } from "./database-ssl";
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
  topology: "config-file" | "supabase-same-project" | "supabase-split-project" | "invalid";
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

const broadDatabaseRoleNames = new Set([
  "postgres",
  "service_role",
  "supabase_admin",
  "admin",
  "root",
]);

const getDatabaseRoleName = (connectionString: string | null) => {
  if (!connectionString) {
    return null;
  }

  try {
    return decodeURIComponent(new URL(connectionString).username).trim() || null;
  } catch {
    return null;
  }
};

export const queryBaseBuddyContentDatabase = async (connectionString: string) => {
  const pool = new Pool({
    allowExitOnIdle: true,
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 1_000,
    max: 1,
    query_timeout: 5_000,
    ssl: getBaseBuddyPostgresSslConfig(connectionString),
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
  const redactedStatus = await getRedactedBaseBuddyConfigStatus();
  const runtimeEnv = readBaseBuddyRuntimeEnv();
  const configPath = redactedStatus.config.path;
  const isFileAppStateBackend = runtimeEnv.appStateBackend === "basebuddy-data";
  const configFileWritable = isFileAppStateBackend
    ? redactedStatus.config.exists
      ? redactedStatus.config.writable
      : (await canAccess(dirname(configPath), constants.W_OK)) ||
        (await canAccess(dirname(dirname(configPath)), constants.W_OK))
    : redactedStatus.config.writable;
  const config = redactedStatus.config.valid ? await loadOptionalBaseBuddyConfig() : null;
  const databaseUrl = runtimeEnv.contentDatabaseUrl;
  const redactedDatabaseUrl = redactEnvCredentialValue({
    key: BASEBUDDY_CONTENT_DATABASE_URL_ENV,
    value: databaseUrl,
  });
  const configChecks: BaseBuddyConfigSetupCheck[] = [
    createCheck({
      key: "basebuddy.config.exists",
      label: isFileAppStateBackend ? "Config file exists" : "App data exists",
      status: redactedStatus.config.exists ? "ready" : "missing",
      value: configPath,
    }),
    createCheck({
      key: "basebuddy.config.readable",
      label: isFileAppStateBackend ? "Config file readable" : "App data readable",
      status: redactedStatus.config.exists
        ? redactedStatus.config.readable
          ? "ready"
          : "invalid"
        : "missing",
      value: redactedStatus.config.exists
        ? configPath
        : isFileAppStateBackend
          ? "Create basebuddy-data/basebuddy.config.json."
          : redactedStatus.config.error ?? "Create BaseBuddy app data.",
    }),
    createCheck({
      key: "basebuddy.config.writable",
      label: isFileAppStateBackend ? "Config path writable" : "App data writable",
      status: configFileWritable
        ? "ready"
        : redactedStatus.config.exists
          ? "invalid"
          : "missing",
      value: configFileWritable
        ? configPath
        : isFileAppStateBackend
          ? "BaseBuddy cannot write this config path."
          : redactedStatus.config.error ?? "BaseBuddy cannot write app data.",
    }),
    createCheck({
      key: "basebuddy.config.valid",
      label: isFileAppStateBackend ? "Config file validates" : "App data validates",
      status: redactedStatus.config.exists
        ? redactedStatus.config.valid
          ? "ready"
          : "invalid"
        : "missing",
      value: redactedStatus.config.exists
        ? redactedStatus.config.error ?? "valid"
        : isFileAppStateBackend
          ? "Create basebuddy-data/basebuddy.config.json."
          : redactedStatus.config.error ?? "Create BaseBuddy app data.",
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
  const databaseRoleName = getDatabaseRoleName(databaseUrl);
  const databaseRoleChecks: BaseBuddyConfigSetupCheck[] = [
    createCheck({
      key: "BASEBUDDY_CONTENT_DATABASE_URL.role",
      label: "Restricted database role",
      required: false,
      status: databaseRoleName
        ? broadDatabaseRoleNames.has(databaseRoleName.toLowerCase())
          ? "invalid"
          : "ready"
        : "missing",
      value: databaseRoleName
        ? broadDatabaseRoleNames.has(databaseRoleName.toLowerCase())
          ? "Use a restricted database role for production."
          : "Using a named database role."
        : `Set ${BASEBUDDY_CONTENT_DATABASE_URL_ENV} first.`,
    }),
  ];

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
      description: isFileAppStateBackend
        ? "The BaseBuddy config file at process.cwd()/basebuddy-data/basebuddy.config.json."
        : "BaseBuddy app data stored in the selected Supabase/Postgres project.",
      status: getSectionStatus(configChecks),
      title: isFileAppStateBackend ? "Config file" : "BaseBuddy app data",
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
      checks: databaseRoleChecks,
      description: "Use a role with only the table and column permissions editors need.",
      status: getSectionStatus(databaseRoleChecks),
      title: "Database role",
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
    topology:
      redactedStatus.config.exists && !redactedStatus.config.valid
        ? "invalid"
        : isFileAppStateBackend
          ? "config-file"
          : runtimeEnv.appStateBackend === "basebuddy-data"
            ? "config-file"
            : runtimeEnv.appStateBackend,
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
