import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  getInstallEnvMode,
  getInstallRuntimeTopology,
  readOptionalInstallEnv,
} from "../src/lib/self-host/install-env";

type CheckStatus = "ready" | "missing" | "invalid" | "skipped";

type SetupCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  value: string | null;
};

type SetupSection = {
  title: string;
  status: CheckStatus;
  checks: SetupCheck[];
};

type ReadinessPayload = {
  expectedSchemaVersion?: unknown;
  missingPermissions?: unknown;
  missingRpcs?: unknown;
  missingRoles?: unknown;
  missingSchemas?: unknown;
  missingTables?: unknown;
  ready?: unknown;
  schemaVersion?: unknown;
};

const EXPECTED_SCHEMA_VERSION = 1;

const SAME_PROJECT_ENV_KEYS = [
  ["BASEBUDDY_SUPABASE_URL", "Supabase project URL"],
  ["BASEBUDDY_SUPABASE_PUBLISHABLE_KEY", "Browser key"],
  ["BASEBUDDY_SUPABASE_SECRET_KEY", "Server key"],
  ["BASEBUDDY_DATABASE_URL", "Database URL"],
] as const;

const SPLIT_PROJECT_ENV_KEYS = [
  ["BASEBUDDY_CONTROL_SUPABASE_URL", "BaseBuddy project URL"],
  ["BASEBUDDY_CONTROL_SUPABASE_PUBLISHABLE_KEY", "BaseBuddy browser key"],
  ["BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY", "BaseBuddy server key"],
  ["BASEBUDDY_CONTROL_DATABASE_URL", "BaseBuddy database URL"],
  ["BASEBUDDY_CONTENT_SUPABASE_URL", "Content project URL"],
  ["BASEBUDDY_CONTENT_SUPABASE_PUBLISHABLE_KEY", "Content browser key"],
  ["BASEBUDDY_CONTENT_SUPABASE_SECRET_KEY", "Content server key"],
  ["BASEBUDDY_CONTENT_DATABASE_URL", "Content database URL"],
] as const;

const STORAGE_ENV_PAIRS = [
  ["BASEBUDDY_S3_ACCESS_KEY_ID", "BASEBUDDY_S3_SECRET_ACCESS_KEY", "Shared S3 credentials"],
  ["BASEBUDDY_MEDIA_S3_ACCESS_KEY_ID", "BASEBUDDY_MEDIA_S3_SECRET_ACCESS_KEY", "Media S3 credentials"],
  ["BASEBUDDY_FILES_S3_ACCESS_KEY_ID", "BASEBUDDY_FILES_S3_SECRET_ACCESS_KEY", "Files S3 credentials"],
] as const;

const shouldPrintJson = process.argv.includes("--json");

const parseDotEnvValue = (rawValue: string) => {
  const value = rawValue.trim();
  const quote = value[0];

  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value;
};

const loadDotEnvFile = (filePath: string) => {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  const source = readFileSync(absolutePath, "utf8");

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = parseDotEnvValue(trimmed.slice(equalsIndex + 1));

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const fingerprint = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 8);

const redactValue = (key: string, value: string) => {
  if (key.endsWith("_DATABASE_URL")) {
    try {
      const parsed = new URL(value);
      parsed.username = parsed.username ? "user" : "";
      parsed.password = parsed.password ? "password" : "";
      return parsed.toString();
    } catch {
      return `set:${fingerprint(value)}`;
    }
  }

  if (key.endsWith("_SUPABASE_URL")) {
    try {
      return new URL(value).origin;
    } catch {
      return `set:${fingerprint(value)}`;
    }
  }

  if (key.includes("SECRET") || key.includes("KEY") || key.includes("CERTIFICATE")) {
    return `set:${fingerprint(value)}`;
  }

  return value;
};

const getSectionStatus = (checks: SetupCheck[]): CheckStatus => {
  if (checks.some((check) => check.status === "invalid")) {
    return "invalid";
  }

  if (checks.some((check) => check.status === "missing")) {
    return "missing";
  }

  if (checks.some((check) => check.status === "skipped")) {
    return "skipped";
  }

  return "ready";
};

const getEnvCheck = (key: string, label: string): SetupCheck => {
  const value = readOptionalInstallEnv(key);

  return {
    key,
    label,
    status: value ? "ready" : "missing",
    value: value ? redactValue(key, value) : null,
  };
};

const getEnvironmentSection = (): SetupSection => {
  const mode = getInstallEnvMode();
  const envKeys = mode === "split-project" || mode === "mixed"
    ? SPLIT_PROJECT_ENV_KEYS
    : SAME_PROJECT_ENV_KEYS;
  const checks = envKeys.map(([key, label]) => getEnvCheck(key, label));

  if (mode === "mixed") {
    checks.push({
      key: "BASEBUDDY_ENV_MODE",
      label: "Install env names",
      status: "invalid",
      value: "Use either same-project env names or split-project env names, not both.",
    });
  }

  return {
    title: "Environment",
    status: getSectionStatus(checks),
    checks,
  };
};

const getTopologySection = (): SetupSection => {
  try {
    const topology = getInstallRuntimeTopology();
    const checks: SetupCheck[] = [
      {
        key: "BASEBUDDY_RUNTIME_TOPOLOGY",
        label: "Runtime topology",
        status: "ready",
        value: topology,
      },
    ];

    return {
      title: "Topology",
      status: "ready",
      checks,
    };
  } catch (error) {
    const checks: SetupCheck[] = [
      {
        key: "BASEBUDDY_RUNTIME_TOPOLOGY",
        label: "Runtime topology",
        status: "invalid",
        value: error instanceof Error ? error.message : "invalid",
      },
    ];

    return {
      title: "Topology",
      status: "invalid",
      checks,
    };
  }
};

const getStorageSection = (): SetupSection => {
  const checks = STORAGE_ENV_PAIRS.flatMap(([accessKey, secretKey, label]) => {
    const accessValue = readOptionalInstallEnv(accessKey);
    const secretValue = readOptionalInstallEnv(secretKey);
    const pairStatus: CheckStatus = accessValue && secretValue ? "ready" : accessValue || secretValue ? "missing" : "ready";

    return [
      {
        key: accessKey,
        label: `${label} access key`,
        status: pairStatus === "missing" && !accessValue ? "missing" : accessValue ? "ready" : "ready",
        value: accessValue ? redactValue(accessKey, accessValue) : null,
      },
      {
        key: secretKey,
        label: `${label} secret key`,
        status: pairStatus === "missing" && !secretValue ? "missing" : secretValue ? "ready" : "ready",
        value: secretValue ? redactValue(secretKey, secretValue) : null,
      },
    ] satisfies SetupCheck[];
  });

  return {
    title: "Storage",
    status: getSectionStatus(checks),
    checks,
  };
};

const normalizeReadinessList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeReadinessVersion = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const getControlPlaneSchemaSection = async (): Promise<SetupSection> => {
  const supabaseUrl =
    readOptionalInstallEnv("BASEBUDDY_CONTROL_SUPABASE_URL") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_URL");
  const secretKey =
    readOptionalInstallEnv("BASEBUDDY_CONTROL_SUPABASE_SECRET_KEY") ??
    readOptionalInstallEnv("BASEBUDDY_SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    return {
      title: "Control-plane schema",
      status: "skipped",
      checks: [
        {
          key: "get_basebuddy_control_plane_readiness",
          label: "Setup readiness check",
          status: "skipped",
          value: "set Supabase env first",
        },
      ],
    };
  }

  try {
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data, error } = await supabase.rpc("get_basebuddy_control_plane_readiness");

    if (error) {
      return {
        title: "Control-plane schema",
        status: "invalid",
        checks: [
          {
            key: "get_basebuddy_control_plane_readiness",
            label: "Setup readiness check",
            status: "invalid",
            value: error.message,
          },
        ],
      };
    }

    const payload = (data ?? {}) as ReadinessPayload;
    const schemaVersion = normalizeReadinessVersion(payload.schemaVersion);
    const expectedSchemaVersion =
      normalizeReadinessVersion(payload.expectedSchemaVersion) || EXPECTED_SCHEMA_VERSION;
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
    const checks: SetupCheck[] = [
      {
        key: "BASEBUDDY_CONTROL_PLANE_SCHEMA_VERSION",
        label: "Setup version",
        status: versionReady ? "ready" : "missing",
        value: schemaVersion > 0 ? `v${schemaVersion}` : `expected v${expectedSchemaVersion}`,
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_SCHEMAS",
        label: "Required private schema",
        status: schemasReady ? "ready" : "missing",
        value: schemasReady ? "ready" : missingSchemas.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_TABLES",
        label: "Required tables",
        status: tablesReady ? "ready" : "missing",
        value: tablesReady ? "ready" : missingTables.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_ROLES",
        label: "Required project roles",
        status: rolesReady ? "ready" : "missing",
        value: rolesReady ? "ready" : missingRoles.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_PERMISSIONS",
        label: "Required permissions",
        status: permissionsReady ? "ready" : "missing",
        value: permissionsReady ? "ready" : missingPermissions.join(", "),
      },
      {
        key: "BASEBUDDY_CONTROL_PLANE_RPCS",
        label: "Required setup functions",
        status: rpcsReady ? "ready" : "missing",
        value: rpcsReady ? "ready" : missingRpcs.join(", "),
      },
    ];

    return {
      title: "Control-plane schema",
      status: ready ? "ready" : getSectionStatus(checks),
      checks,
    };
  } catch (error) {
    return {
      title: "Control-plane schema",
      status: "invalid",
      checks: [
        {
          key: "get_basebuddy_control_plane_readiness",
          label: "Setup readiness check",
          status: "invalid",
          value: error instanceof Error ? error.message : "check failed",
        },
      ],
    };
  }
};

const printTextReport = (sections: SetupSection[]) => {
  console.log("BaseBuddy self-host setup check");

  for (const section of sections) {
    console.log("");
    console.log(`${section.title}: ${section.status}`);

    for (const check of section.checks) {
      const value = check.value ? ` (${check.value})` : "";
      console.log(`- ${check.key}: ${check.status}${value}`);
    }
  }
};

const main = async () => {
  loadDotEnvFile(".env");

  const sections = [
    getEnvironmentSection(),
    await getControlPlaneSchemaSection(),
    getTopologySection(),
    getStorageSection(),
  ];
  const hasBlockingIssue = sections.some((section) => section.status !== "ready");

  if (shouldPrintJson) {
    console.log(JSON.stringify({ ready: !hasBlockingIssue, sections }, null, 2));
  } else {
    printTextReport(sections);
  }

  process.exitCode = hasBlockingIssue ? 1 : 0;
};

void main();
