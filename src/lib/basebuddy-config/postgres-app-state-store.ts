import {
  baseBuddyConfigSchema,
  createDefaultBaseBuddyConfig,
  formatBaseBuddyConfigValidationError,
  type BaseBuddyConfig,
  type CreateDefaultBaseBuddyConfigInput,
} from "./schema";

export const BASEBUDDY_APP_STATE_SCHEMA = "basebuddy";
export const BASEBUDDY_APP_STATE_CONFIG_ID = "default";

export type PostgresBaseBuddyConfigQueryClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ) => Promise<{ rows: TRow[] }>;
};

export type PostgresBaseBuddyConfigStore = {
  ensure: (seed: CreateDefaultBaseBuddyConfigInput) => Promise<BaseBuddyConfig>;
  load: () => Promise<BaseBuddyConfig>;
  loadOptional: () => Promise<BaseBuddyConfig | null>;
  write: (
    updater: (config: BaseBuddyConfig) => BaseBuddyConfig | Promise<BaseBuddyConfig>,
  ) => Promise<BaseBuddyConfig>;
};

export type PostgresBaseBuddyAuditEvent = {
  [key: string]: unknown;
  createdAt: string;
  id: string;
  type: string;
};

let pendingPostgresConfigWrite: Promise<void> = Promise.resolve();

const createInvalidConfigError = (error: unknown) => {
  if (error && typeof error === "object" && "issues" in error) {
    return Object.assign(
      new Error(
        `BaseBuddy app-state config is invalid: ${formatBaseBuddyConfigValidationError(
          error as Parameters<typeof formatBaseBuddyConfigValidationError>[0],
        )}`,
      ),
      { cause: error },
    );
  }

  return Object.assign(new Error("BaseBuddy app-state config is invalid."), {
    cause: error,
  });
};

const validateBaseBuddyConfig = (config: unknown): BaseBuddyConfig => {
  const result = baseBuddyConfigSchema.safeParse(config);

  if (!result.success) {
    throw createInvalidConfigError(result.error);
  }

  return result.data;
};

export const BASEBUDDY_POSTGRES_APP_STATE_SETUP_SQL = `
create schema if not exists basebuddy;

create table if not exists basebuddy.app_state (
  id text primary key,
  config jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists basebuddy.audit_events (
  id text primary key,
  event jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);
`;

export const ensurePostgresBaseBuddyAppStateSchema = async (
  client: PostgresBaseBuddyConfigQueryClient,
) => {
  await client.query(BASEBUDDY_POSTGRES_APP_STATE_SETUP_SQL);
};

export const appendPostgresBaseBuddyAuditEvent = async <
  TEvent extends PostgresBaseBuddyAuditEvent,
>(
  client: PostgresBaseBuddyConfigQueryClient,
  event: TEvent,
) => {
  await ensurePostgresBaseBuddyAppStateSchema(client);
  const result = await client.query<{ event: unknown }>(
    `insert into basebuddy.audit_events (id, event)
     values ($1, $2)
     returning event`,
    [event.id, event],
  );

  return (result.rows[0]?.event ?? event) as TEvent;
};

export const createPostgresBaseBuddyConfigStore = (
  client: PostgresBaseBuddyConfigQueryClient,
): PostgresBaseBuddyConfigStore => {
  const loadOptional = async () => {
    await ensurePostgresBaseBuddyAppStateSchema(client);
    const result = await client.query<{ config: unknown }>(
      "select config from basebuddy.app_state where id = $1",
      [BASEBUDDY_APP_STATE_CONFIG_ID],
    );
    const row = result.rows[0];

    return row ? validateBaseBuddyConfig(row.config) : null;
  };

  const load = async () => {
    const config = await loadOptional();

    if (!config) {
      throw new Error("BaseBuddy app-state config does not exist.");
    }

    return config;
  };

  const insert = async (config: BaseBuddyConfig) => {
    const validatedConfig = validateBaseBuddyConfig(config);
    const result = await client.query<{ config: unknown }>(
      `insert into basebuddy.app_state (id, config)
       values ($1, $2)
       on conflict (id) do nothing
       returning config`,
      [BASEBUDDY_APP_STATE_CONFIG_ID, validatedConfig],
    );

    return result.rows[0]?.config
      ? validateBaseBuddyConfig(result.rows[0].config)
      : await load();
  };

  const update = async (config: BaseBuddyConfig) => {
    const validatedConfig = validateBaseBuddyConfig(config);
    const result = await client.query<{ config: unknown }>(
      `update basebuddy.app_state
       set config = $2, updated_at = timezone('utc', now())
       where id = $1
       returning config`,
      [BASEBUDDY_APP_STATE_CONFIG_ID, validatedConfig],
    );

    if (!result.rows[0]) {
      throw new Error("BaseBuddy app-state config does not exist.");
    }

    return validateBaseBuddyConfig(result.rows[0].config);
  };

  const ensure = async (seed: CreateDefaultBaseBuddyConfigInput) => {
    const operation = pendingPostgresConfigWrite
      .catch(() => undefined)
      .then(async () => {
        const existingConfig = await loadOptional();

        if (existingConfig) {
          return existingConfig;
        }

        return insert(createDefaultBaseBuddyConfig(seed));
      });

    pendingPostgresConfigWrite = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  };

  const write = async (
    updater: (config: BaseBuddyConfig) => BaseBuddyConfig | Promise<BaseBuddyConfig>,
  ) => {
    const operation = pendingPostgresConfigWrite
      .catch(() => undefined)
      .then(async () => {
        const currentConfig = await load();
        const nextConfig = await updater(currentConfig);

        return update(nextConfig);
      });

    pendingPostgresConfigWrite = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  };

  return {
    ensure,
    load,
    loadOptional,
    write,
  };
};
