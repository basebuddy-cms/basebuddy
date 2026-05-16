import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import { Pool } from "pg";

import {
  getFirstDefinedInstallEnv,
  getInstallContentDatabaseUrl,
  getInstallContentPlaneEnv,
  getInstallContentSupabasePublishableKey,
  getInstallContentSupabaseSecretKey,
  getInstallContentSupabaseUrl,
  getInstallEnvMode,
  getInstallControlPlaneEnv,
  getInstallRuntimeTopology,
  hasCanonicalPlaneEnv,
  readOptionalInstallEnv,
  type InstallRuntimeTopology,
} from "@/lib/self-host/install-env";
import { getInstallAuthProviders } from "@/lib/self-host/auth-providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";
export {
  validateInstallRuntimeConfiguration,
  validateInstallStorageConfiguration,
} from "@/lib/self-host/install-runtime-validation";
export {
  getInstallContentDatabaseUrl,
  getInstallContentSupabasePublishableKey,
  getInstallContentSupabaseUrl,
  getInstallControlPlaneDatabaseUrl,
  getInstallRuntimeTopology,
  type InstallRuntimeTopology,
} from "@/lib/self-host/install-env";

export type InstallRuntimeContext = {
  apiUrl: string;
  databaseUrl: string;
  publishableKey: string;
};

export type InstallDatabaseSslConfig =
  | false
  | {
      rejectUnauthorized: false;
    }
  | {
      ca: string;
      rejectUnauthorized: true;
    };

export type InstallS3CompatibleStorageKind = "files" | "media";

export type InstallS3CompatibleStorageCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

export const getInstallContentSupabaseServiceRoleKey = getInstallContentSupabaseSecretKey;

const getS3EnvKeysForKind = (kind: InstallS3CompatibleStorageKind) => {
  const prefix = kind === "media" ? "BASEBUDDY_MEDIA_S3" : "BASEBUDDY_FILES_S3";

  return {
    accessKeyId: `${prefix}_ACCESS_KEY_ID`,
    secretAccessKey: `${prefix}_SECRET_ACCESS_KEY`,
  };
};

const getS3CompatibleStorageCredentialPair = ({
  accessKeyIdKey,
  secretAccessKeyKey,
}: {
  accessKeyIdKey: string;
  secretAccessKeyKey: string;
}) => {
  const accessKeyId = readOptionalInstallEnv(accessKeyIdKey);
  const secretAccessKey = readOptionalInstallEnv(secretAccessKeyKey);

  if (!accessKeyId && !secretAccessKey) {
    return null;
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `Incomplete S3 storage env configuration: set both ${accessKeyIdKey} and ${secretAccessKeyKey}.`,
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
  } satisfies InstallS3CompatibleStorageCredentials;
};

const getSharedS3CompatibleStorageCredentials = () =>
  getS3CompatibleStorageCredentialPair({
    accessKeyIdKey: "BASEBUDDY_S3_ACCESS_KEY_ID",
    secretAccessKeyKey: "BASEBUDDY_S3_SECRET_ACCESS_KEY",
  });

export const getInstallS3CompatibleStorageCredentials = (
  kind: InstallS3CompatibleStorageKind,
): InstallS3CompatibleStorageCredentials | null => {
  const kindKeys = getS3EnvKeysForKind(kind);
  const kindCredentials = getS3CompatibleStorageCredentialPair({
    accessKeyIdKey: kindKeys.accessKeyId,
    secretAccessKeyKey: kindKeys.secretAccessKey,
  });

  return kindCredentials ?? getSharedS3CompatibleStorageCredentials();
};

export const getInstallS3CompatibleStorageCredentialStatus = (
  kind: InstallS3CompatibleStorageKind,
) => {
  const credentials = getInstallS3CompatibleStorageCredentials(kind);

  return {
    hasS3AccessKeyId: Boolean(credentials?.accessKeyId),
    hasS3SecretAccessKey: Boolean(credentials?.secretAccessKey),
  };
};

export const getInstallDatabaseUrl = () => {
  return getInstallContentDatabaseUrl();
};

export const getInstallDatabaseRootCertificate = () => {
  const inlineValue = getFirstDefinedInstallEnv(
    "BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE",
    "BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE",
  )?.replace(/\\n/g, "\n");
  const filePath = getFirstDefinedInstallEnv(
    "BASEBUDDY_CONTENT_SESSION_POOLER_ROOT_CERTIFICATE_FILE",
    "BASEBUDDY_CONTROL_SESSION_POOLER_ROOT_CERTIFICATE_FILE",
  );

  if (inlineValue) {
    return inlineValue;
  }

  if (!filePath) {
    return null;
  }

  try {
    const fileValue = fs.readFileSync(filePath, "utf8").trim();
    return fileValue || null;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not read configured Session Pooler root certificate file: ${error.message}`
        : "Could not read configured Session Pooler root certificate file",
    );
  }
};

export const getInstallDatabaseSslConfig = (): InstallDatabaseSslConfig => {
  const rootCertificate = getInstallDatabaseRootCertificate();

  if (rootCertificate) {
    return {
      ca: rootCertificate,
      rejectUnauthorized: true,
    };
  }

  try {
    const databaseUrl = new URL(getInstallContentDatabaseUrl());
    const sslMode = databaseUrl.searchParams.get("sslmode")?.toLowerCase();

    if (sslMode === "disable") {
      return false;
    }
  } catch {
    // Startup validation reports malformed URLs elsewhere; default to TLS.
  }

  return {
    rejectUnauthorized: false,
  };
};

export const getOptionalInstallRuntimeContext = (): InstallRuntimeContext | null => {
  const databaseUrl =
    getInstallContentPlaneEnv().databaseUrl ??
    (getInstallRuntimeTopology() === "split" || hasCanonicalPlaneEnv()
      ? null
      : getInstallControlPlaneEnv().databaseUrl);

  if (!databaseUrl) {
    return null;
  }

  return {
    apiUrl: getInstallContentSupabaseUrl(),
    databaseUrl,
    publishableKey: getInstallContentSupabasePublishableKey(),
  };
};

export const getInstallRuntimeContext = (): InstallRuntimeContext => {
  const databaseUrl = getInstallContentDatabaseUrl();

  return {
    apiUrl: getInstallContentSupabaseUrl(),
    databaseUrl,
    publishableKey: getInstallContentSupabasePublishableKey(),
  };
};

export type InstallSetupCheckStatus = "ready" | "missing" | "invalid";

export type InstallSetupCheck = {
  key: string;
  label: string;
  required: boolean;
  status: InstallSetupCheckStatus;
  value: string | null;
};

export type InstallSetupSectionStatus = {
  description: string;
  status: InstallSetupCheckStatus;
  title: string;
  checks: InstallSetupCheck[];
};

export type InstallSetupStatus = {
  topology: InstallRuntimeTopology | "invalid";
  sections: InstallSetupSectionStatus[];
};

type InstallReachabilityPlane = {
  databaseUrl: string | null;
  label: string;
  supabasePublishableKey: string | null;
  supabaseUrl: string | null;
};

type InstallReachabilityDependencies = {
  fetch?: typeof fetch;
  queryDatabase?: (connectionString: string) => Promise<void>;
};

export const isInstallSetupReady = (status: InstallSetupStatus) =>
  status.sections.every((section) => section.status === "ready");

export const BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION = 1;
const CONTROL_PLANE_READINESS_RPC_TIMEOUT_MS = 5_000;

type ControlPlaneSchemaReadinessRpcPayload = {
  expectedSchemaVersion?: unknown;
  missingPermissions?: unknown;
  missingRpcs?: unknown;
  missingRoles?: unknown;
  missingSchemas?: unknown;
  missingTables?: unknown;
  ready?: unknown;
  schemaVersion?: unknown;
};

const getFingerprint = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);

const redactInstallEnvValue = (key: string, value: string) => {
  if (key.endsWith("_DATABASE_URL")) {
    try {
      const parsed = new URL(value);
      parsed.username = parsed.username ? "user" : "";
      parsed.password = parsed.password ? "password" : "";
      return parsed.toString();
    } catch {
      return `set:${getFingerprint(value)}`;
    }
  }

  if (key.endsWith("_SUPABASE_URL")) {
    try {
      return new URL(value).origin;
    } catch {
      return `set:${getFingerprint(value)}`;
    }
  }

  if (key.includes("SECRET") || key.includes("KEY") || key.includes("CERTIFICATE")) {
    return `set:${getFingerprint(value)}`;
  }

  return value;
};

const getInstallSetupCheck = ({
  key,
  label,
  required = true,
}: {
  key: string;
  label: string;
  required?: boolean;
}): InstallSetupCheck => {
  const value = readOptionalInstallEnv(key);

  return {
    key,
    label,
    required,
    status: value ? "ready" : required ? "missing" : "ready",
    value: value ? redactInstallEnvValue(key, value) : null,
  };
};

const getReachabilityPlanes = (): InstallReachabilityPlane[] => {
  const mode = getInstallEnvMode();

  if (mode === "same-project" || mode === "missing") {
    return [
      {
        databaseUrl: readOptionalInstallEnv("BASEBUDDY_DATABASE_URL"),
        label: "Supabase project",
        supabasePublishableKey: readOptionalInstallEnv("BASEBUDDY_SUPABASE_PUBLISHABLE_KEY"),
        supabaseUrl: readOptionalInstallEnv("BASEBUDDY_SUPABASE_URL"),
      },
    ];
  }

  return [
    {
      databaseUrl: readOptionalInstallEnv("BASEBUDDY_CONTROL_DATABASE_URL"),
      label: "Workspace project",
      supabasePublishableKey: readOptionalInstallEnv("BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY"),
      supabaseUrl: readOptionalInstallEnv("BASEBUDDY_CONTROL_SUPABASE_URL"),
    },
    {
      databaseUrl: readOptionalInstallEnv("BASEBUDDY_CONTENT_DATABASE_URL"),
      label: "Content project",
      supabasePublishableKey: readOptionalInstallEnv("BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY"),
      supabaseUrl: readOptionalInstallEnv("BASEBUDDY_CONTENT_SUPABASE_URL"),
    },
  ];
};

const createReachabilityCheck = ({
  key,
  label,
  status,
  value,
}: {
  key: string;
  label: string;
  status: InstallSetupCheckStatus;
  value: string | null;
}): InstallSetupCheck => ({
  key,
  label,
  required: true,
  status,
  value,
});

const getReachabilityUrl = (baseUrl: string, path: string) => {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  return url.toString();
};

const getSupabaseProjectReference = (supabaseUrl: string) => {
  try {
    const hostname = new URL(supabaseUrl).hostname;

    if (hostname.endsWith(".supabase.co")) {
      return hostname.split(".")[0] || null;
    }
  } catch {
    return null;
  }

  return null;
};

const getReachabilityFetchOptions = (publishableKey: string) => ({
  headers: {
    apikey: publishableKey,
  },
});

const runReachabilityFetch = async ({
  fetchImpl,
  path,
  plane,
}: {
  fetchImpl: typeof fetch;
  path: string;
  plane: InstallReachabilityPlane;
}) => {
  if (!plane.supabaseUrl || !plane.supabasePublishableKey) {
    return createReachabilityCheck({
      key: plane.label,
      label: plane.label,
      status: "missing",
      value: "Add the Supabase URL and browser key first.",
    });
  }

  try {
    const response = await fetchImpl(
      getReachabilityUrl(plane.supabaseUrl, path),
      getReachabilityFetchOptions(plane.supabasePublishableKey),
    );

    return createReachabilityCheck({
      key: plane.label,
      label: plane.label,
      status: response.ok ? "ready" : "invalid",
      value: response.ok ? new URL(plane.supabaseUrl).origin : `HTTP ${response.status}`,
    });
  } catch {
    return createReachabilityCheck({
      key: plane.label,
      label: plane.label,
      status: "invalid",
      value: "Could not reach this Supabase project.",
    });
  }
};

const normalizeAuthProviderSettings = (value: unknown) => {
  const settings = value as {
    external?: Record<string, unknown>;
    mailer_autoconfirm?: unknown;
  } | null;
  const externalProviders = settings?.external && typeof settings.external === "object"
    ? Object.entries(settings.external)
        .filter(([, enabled]) => enabled === true)
        .map(([provider]) => provider)
        .sort()
    : [];

  return externalProviders;
};

const runAuthReachabilityFetch = async ({
  fetchImpl,
  plane,
}: {
  fetchImpl: typeof fetch;
  plane: InstallReachabilityPlane;
}): Promise<InstallSetupCheck[]> => {
  if (!plane.supabaseUrl || !plane.supabasePublishableKey) {
    return [
      createReachabilityCheck({
        key: plane.label,
        label: plane.label,
        status: "missing",
        value: "Add the Supabase URL and browser key first.",
      }),
    ];
  }

  try {
    const response = await fetchImpl(
      getReachabilityUrl(plane.supabaseUrl, "/auth/v1/settings"),
      getReachabilityFetchOptions(plane.supabasePublishableKey),
    );
    const reachabilityCheck = createReachabilityCheck({
      key: plane.label,
      label: plane.label,
      status: response.ok ? "ready" : "invalid",
      value: response.ok ? new URL(plane.supabaseUrl).origin : `HTTP ${response.status}`,
    });

    if (!response.ok) {
      return [reachabilityCheck];
    }

    const payload = await response.json().catch(() => null);
    const providers = normalizeAuthProviderSettings(payload);

    return [
      reachabilityCheck,
      createReachabilityCheck({
        key: `${plane.label} providers`,
        label: `${plane.label} detected providers`,
        status: "ready",
        value: providers.length ? providers.join(", ") : "Provider details unavailable",
      }),
    ];
  } catch {
    return [
      createReachabilityCheck({
        key: plane.label,
        label: plane.label,
        status: "invalid",
        value: "Could not reach Supabase Auth.",
      }),
    ];
  }
};

const queryInstallDatabase = async (connectionString: string) => {
  const pool = new Pool({
    allowExitOnIdle: true,
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 1_000,
    max: 1,
    query_timeout: 5_000,
    ssl: getInstallDatabaseSslConfig(),
    statement_timeout: 5_000,
  });

  try {
    await pool.query("select 1");
  } finally {
    await pool.end();
  }
};

const getSectionStatus = (checks: InstallSetupCheck[]): InstallSetupCheckStatus =>
  checks.some((check) => check.status === "invalid")
    ? "invalid"
    : checks.some((check) => check.status === "missing")
      ? "missing"
      : "ready";

const getStorageSetupSection = (): InstallSetupSectionStatus => {
  const checks = [
    getInstallSetupCheck({
      key: "BASEBUDDY_S3_ACCESS_KEY_ID",
      label: "Shared S3 access key",
      required: false,
    }),
    getInstallSetupCheck({
      key: "BASEBUDDY_S3_SECRET_ACCESS_KEY",
      label: "Shared S3 secret key",
      required: false,
    }),
    getInstallSetupCheck({
      key: "BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID",
      label: "Media S3 access key",
      required: false,
    }),
    getInstallSetupCheck({
      key: "BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY",
      label: "Media S3 secret key",
      required: false,
    }),
    getInstallSetupCheck({
      key: "BASEBUDDY_FILES_S3_ACCESS_KEY_ID",
      label: "Files S3 access key",
      required: false,
    }),
    getInstallSetupCheck({
      key: "BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY",
      label: "Files S3 secret key",
      required: false,
    }),
  ];
  const incompletePairs = [
    ["BASEBUDDY_S3_ACCESS_KEY_ID", "BASEBUDDY_S3_SECRET_ACCESS_KEY"],
    ["BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID", "BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY"],
    ["BASEBUDDY_FILES_S3_ACCESS_KEY_ID", "BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY"],
  ].some(([accessKeyIdKey, secretAccessKeyKey]) => {
    const hasAccessKeyId = Boolean(readOptionalInstallEnv(accessKeyIdKey));
    const hasSecretAccessKey = Boolean(readOptionalInstallEnv(secretAccessKeyKey));

    if (hasAccessKeyId !== hasSecretAccessKey) {
      const missingKey = hasAccessKeyId ? secretAccessKeyKey : accessKeyIdKey;
      const missingCheck = checks.find((check) => check.key === missingKey);

      if (missingCheck) {
        missingCheck.status = "missing";
      }
    }

    return hasAccessKeyId !== hasSecretAccessKey;
  });

  return {
    checks,
    description: "Optional upload storage access for media and files.",
    status: incompletePairs ? "invalid" : getSectionStatus(checks),
    title: "Upload storage",
  };
};

const getSameProjectEnvironmentChecks = () => [
  getInstallSetupCheck({
    key: "BASEBUDDY_SUPABASE_URL",
    label: "Supabase project URL",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_SUPABASE_PUBLISHABLE_KEY",
    label: "Browser key",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_SUPABASE_SECRET_KEY",
    label: "Server key",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_DATABASE_URL",
    label: "Database URL",
  }),
];

const getSplitProjectEnvironmentChecks = () => [
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTROL_SUPABASE_URL",
    label: "Workspace app URL",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY",
    label: "Workspace browser key",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY",
    label: "Workspace server key",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTROL_DATABASE_URL",
    label: "Workspace database URL",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTENT_SUPABASE_URL",
    label: "Content app URL",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY",
    label: "Content browser key",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY",
    label: "Content server key",
  }),
  getInstallSetupCheck({
    key: "BASEBUDDY_CONTENT_DATABASE_URL",
    label: "Content database URL",
  }),
];

const getAuthProviderSetupCheck = (): InstallSetupCheck => {
  try {
    return {
      key: "BASEBUDDY_AUTH_PROVIDERS",
      label: "Enabled sign-in methods",
      required: false,
      status: "ready",
      value: getInstallAuthProviders().join(", "),
    };
  } catch {
    return {
      key: "BASEBUDDY_AUTH_PROVIDERS",
      label: "Enabled sign-in methods",
      required: false,
      status: "invalid",
      value: "unsupported sign-in method",
    };
  }
};

const getControlPlaneSchemaPlaceholderSection = (): InstallSetupSectionStatus => ({
  checks: [
    {
      key: "BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION",
      label: "Setup version",
      required: true,
      status: "missing",
      value: `expected v${BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION}`,
    },
    {
      key: "BASEBUDDY_CONTROL_PLANE_SCHEMAS",
      label: "Required private schema",
      required: true,
      status: "missing",
      value: "not checked",
    },
    {
      key: "BASEBUDDY_CONTROL_PLANE_TABLES",
      label: "Required tables",
      required: true,
      status: "missing",
      value: "not checked",
    },
    {
      key: "BASEBUDDY_CONTROL_PLANE_ROLES",
      label: "Required project roles",
      required: true,
      status: "missing",
      value: "not checked",
    },
    {
      key: "BASEBUDDY_CONTROL_PLANE_PERMISSIONS",
      label: "Required permissions",
      required: true,
      status: "missing",
      value: "not checked",
    },
    {
      key: "BASEBUDDY_CONTROL_PLANE_RPCS",
      label: "Required setup functions",
      required: true,
      status: "missing",
      value: "not checked",
    },
  ],
  description: "Required database setup for BaseBuddy.",
  status: "missing",
  title: "BaseBuddy tables",
});

const normalizeReadinessList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeReadinessVersion = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const withTimeout = async <T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  message: string,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const getControlPlaneSchemaSetupSection = async (): Promise<InstallSetupSectionStatus> => {
  try {
    getSupabaseUrl();
    getSupabaseServiceRoleKey();
  } catch {
    return getControlPlaneSchemaPlaceholderSection();
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await withTimeout(
      supabase.rpc("get_basebuddy_control_plane_readiness"),
      CONTROL_PLANE_READINESS_RPC_TIMEOUT_MS,
      "BaseBuddy setup readiness check timed out.",
    );

    if (error) {
      return {
        checks: [
          {
            key: "BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION",
            label: "Setup version",
            required: true,
            status: "invalid",
            value: `expected v${BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION}`,
          },
          {
            key: "BASEBUDDY_CONTROL_PLANE_READINESS_RPC",
            label: "Setup readiness check",
            required: true,
            status: "invalid",
            value: "unavailable",
          },
        ],
        description: "Required database setup for BaseBuddy.",
        status: "invalid",
        title: "BaseBuddy tables",
      };
    }

    const payload = (data ?? {}) as ControlPlaneSchemaReadinessRpcPayload;
    const schemaVersion = normalizeReadinessVersion(payload.schemaVersion);
    const expectedSchemaVersion =
      normalizeReadinessVersion(payload.expectedSchemaVersion) ||
      BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION;
    const missingSchemas = normalizeReadinessList(payload.missingSchemas);
    const missingTables = normalizeReadinessList(payload.missingTables);
    const missingRoles = normalizeReadinessList(payload.missingRoles);
    const missingPermissions = normalizeReadinessList(payload.missingPermissions);
    const missingRpcs = normalizeReadinessList(payload.missingRpcs);
    const versionReady = schemaVersion >= expectedSchemaVersion;
    const schemasReady = missingSchemas.length === 0;
    const tablesReady = missingTables.length === 0;
    const rolesReady = missingRoles.length === 0;
    const permissionsReady = missingPermissions.length === 0;
    const rpcsReady = missingRpcs.length === 0;
    const ready =
      payload.ready === true &&
      versionReady &&
      schemasReady &&
      tablesReady &&
      rolesReady &&
      permissionsReady &&
      rpcsReady;

    const checks: InstallSetupCheck[] = [
      {
        key: "BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION",
        label: "Setup version",
        required: true,
        status: versionReady ? "ready" : "missing",
        value: schemaVersion > 0 ? `v${schemaVersion}` : `expected v${expectedSchemaVersion}`,
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_SCHEMAS",
        label: "Required private schema",
        required: true,
        status: schemasReady ? "ready" : "missing",
        value: schemasReady ? "ready" : missingSchemas.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_TABLES",
        label: "Required tables",
        required: true,
        status: tablesReady ? "ready" : "missing",
        value: tablesReady ? "ready" : missingTables.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_ROLES",
        label: "Required project roles",
        required: true,
        status: rolesReady ? "ready" : "missing",
        value: rolesReady ? "ready" : missingRoles.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_PERMISSIONS",
        label: "Required permissions",
        required: true,
        status: permissionsReady ? "ready" : "missing",
        value: permissionsReady ? "ready" : missingPermissions.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_RPCS",
        label: "Required setup functions",
        required: true,
        status: rpcsReady ? "ready" : "missing",
        value: rpcsReady ? "ready" : missingRpcs.join(", "),
      },
    ];

    return {
      checks,
      description: "Required database setup for BaseBuddy.",
      status: ready ? "ready" : getSectionStatus(checks),
      title: "BaseBuddy tables",
    };
  } catch {
    return {
      checks: [
        {
          key: "BASEBUDDY_CONTROL_PLANE_READINESS_RPC",
          label: "Setup readiness check",
          required: true,
          status: "invalid",
          value: "check failed",
        },
      ],
      description: "Required database setup for BaseBuddy.",
      status: "invalid",
      title: "BaseBuddy tables",
    };
  }
};

export const getSupabaseApiSetupSection = async ({
  fetch: fetchImpl = fetch,
}: InstallReachabilityDependencies = {}): Promise<InstallSetupSectionStatus> => {
  const checks = (
    await Promise.all(
      getReachabilityPlanes().map(async (plane) => {
        const reachabilityCheck = await runReachabilityFetch({
        fetchImpl,
        path: "/rest/v1/",
        plane,
        });
        const projectReference = plane.supabaseUrl ? getSupabaseProjectReference(plane.supabaseUrl) : null;

        if (!projectReference || reachabilityCheck.status !== "ready") {
          return [reachabilityCheck];
        }

        return [
          reachabilityCheck,
          createReachabilityCheck({
            key: `${plane.label} reference`,
            label: `${plane.label} reference`,
            status: "ready",
            value: projectReference,
          }),
        ];
      }),
    )
  ).flat();

  return {
    checks,
    description: "Checks that BaseBuddy can reach the configured Supabase API URL.",
    status: getSectionStatus(checks),
    title: "Supabase API",
  };
};

export const getAuthEndpointSetupSection = async ({
  fetch: fetchImpl = fetch,
}: InstallReachabilityDependencies = {}): Promise<InstallSetupSectionStatus> => {
  const checks = (
    await Promise.all(
    getReachabilityPlanes().map((plane) =>
      runAuthReachabilityFetch({
        fetchImpl,
        plane,
      }),
    ),
    )
  ).flat();

  return {
    checks,
    description: "Checks that Supabase Auth is reachable for sign-in.",
    status: getSectionStatus(checks),
    title: "Auth endpoint",
  };
};

export const getDatabaseConnectionSetupSections = async ({
  queryDatabase = queryInstallDatabase,
}: InstallReachabilityDependencies = {}): Promise<InstallSetupSectionStatus[]> => {
  const planes = getReachabilityPlanes();

  return Promise.all(
    planes.map(async (plane, index) => {
      const isUnified = planes.length === 1;
      const title = isUnified
        ? "Database"
        : index === 0
          ? "Workspace database"
          : "Content database";
      const key = isUnified
        ? "BASEBUDDY_DATABASE_URL"
        : index === 0
          ? "BASEBUDDY_CONTROL_DATABASE_URL"
          : "BASEBUDDY_CONTENT_DATABASE_URL";
      let check: InstallSetupCheck;

      if (!plane.databaseUrl) {
        check = createReachabilityCheck({
          key,
          label: `${plane.label} database`,
          status: "missing",
          value: "Add the database URL first.",
        });
      } else {
        try {
          await queryDatabase(plane.databaseUrl);
          check = createReachabilityCheck({
            key,
            label: `${plane.label} database`,
            status: "ready",
            value: redactInstallEnvValue(key, plane.databaseUrl),
          });
        } catch {
          check = createReachabilityCheck({
            key,
            label: `${plane.label} database`,
            status: "invalid",
            value: "Could not connect with this database URL.",
          });
        }
      }

      return {
        checks: [check],
        description: "Checks that BaseBuddy can connect to this Postgres database.",
        status: getSectionStatus([check]),
        title,
      };
    }),
  );
};

export const getInstallSetupStatus = ({
  additionalSections = [],
  controlPlaneSchemaSection,
}: {
  additionalSections?: InstallSetupSectionStatus[];
  controlPlaneSchemaSection?: InstallSetupSectionStatus;
} = {}): InstallSetupStatus => {
  const installEnvMode = getInstallEnvMode();
  const sameProjectChecks = getSameProjectEnvironmentChecks();
  const splitProjectChecks = getSplitProjectEnvironmentChecks();
  const usesSplitProjectChecks =
    installEnvMode === "split-project" || installEnvMode === "mixed";
  const environmentChecks = usesSplitProjectChecks ? splitProjectChecks : sameProjectChecks;
  const workspaceChecks = usesSplitProjectChecks
    ? splitProjectChecks.slice(0, 4)
    : sameProjectChecks;
  const signInChecks = [...workspaceChecks.slice(0, 2), getAuthProviderSetupCheck()];
  const contentChecks = usesSplitProjectChecks ? splitProjectChecks.slice(4) : sameProjectChecks;
  let topology: InstallSetupStatus["topology"] = "invalid";
  let topologyChecks: InstallSetupCheck[] = [];

  try {
    topology = getInstallRuntimeTopology();
    topologyChecks = [
      {
        key: "BASEBUDDY_RUNTIME_TOPOLOGY",
        label: "Install layout",
        required: false,
        status: "ready",
        value: topology,
      },
    ];
  } catch {
    topologyChecks = [
      {
        key: "BASEBUDDY_RUNTIME_TOPOLOGY",
        label: "Install layout",
        required: false,
        status: "invalid",
        value: "invalid",
      },
    ];
  }

  const sections: InstallSetupSectionStatus[] = [
    {
      checks: environmentChecks,
      description: "App configuration required for this self-host install.",
      status: getSectionStatus(environmentChecks),
      title: "App configuration",
    },
    {
      checks: workspaceChecks,
      description: "Workspace connection values for BaseBuddy.",
      status: getSectionStatus(workspaceChecks),
      title: "Workspace connection",
    },
    controlPlaneSchemaSection
      ? {
          ...controlPlaneSchemaSection,
          description: "Required database setup for BaseBuddy.",
          title: "BaseBuddy tables",
        }
      : getControlPlaneSchemaPlaceholderSection(),
    {
      checks: signInChecks,
      description: "Auth URL and publishable key readiness for sign-in flows.",
      status: getSectionStatus(signInChecks),
      title: "Sign-in",
    },
    {
      checks: contentChecks,
      description: "Content connection values for existing content.",
      status: getSectionStatus(contentChecks),
      title: "Content connection",
    },
    getStorageSetupSection(),
    ...additionalSections,
    {
      checks: topologyChecks,
      description: "Whether this install uses one connection set or separate content connections.",
      status: getSectionStatus(topologyChecks),
      title: "Install layout",
    },
  ];

  return {
    sections,
    topology,
  };
};
