import { randomUUID } from "node:crypto";

import {
  getBaseBuddyPasswordIssues,
  isValidBaseBuddyAccountEmail,
} from "@/lib/basebuddy-config/account-validation";
import { appendBaseBuddyAuditEvent } from "@/lib/basebuddy-config/audit-log";
import { hashBaseBuddyPassword } from "@/lib/basebuddy-config/auth";
import {
  BASEBUDDY_AUTH_SECRET_ENV,
  BASEBUDDY_CONTENT_DATABASE_URL_ENV,
  BASEBUDDY_SUPABASE_PUBLISHABLE_KEY_ENV,
  BASEBUDDY_SUPABASE_SECRET_KEY_ENV,
  BASEBUDDY_SUPABASE_URL_ENV,
  readBaseBuddyRuntimeEnv,
} from "@/lib/basebuddy-config/env";
import type { BaseBuddyConfig, BaseBuddyConfigUser } from "@/lib/basebuddy-config/schema";
import {
  ensureBaseBuddyConfig,
  loadOptionalBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "@/lib/basebuddy-config/store";

type InitialSetupDependencies = {
  now?: () => Date | string;
  randomBytes?: (byteCount: number) => Buffer;
  randomUUID?: () => string;
};

type CreateInitialBaseBuddySetupInput = {
  dependencies?: InitialSetupDependencies;
  owner: {
    email: string;
    name: string;
    password: string;
  };
};

const getIsoNow = (dependencies: InitialSetupDependencies) => {
  const value = dependencies.now?.() ?? new Date();

  return value instanceof Date ? value.toISOString() : value;
};

const getRandomUUID = (dependencies: InitialSetupDependencies) =>
  (dependencies.randomUUID ?? randomUUID)();

const normalizeOwnerInput = (owner: CreateInitialBaseBuddySetupInput["owner"]) => {
  const email = owner.email.trim().toLowerCase();
  const name = owner.name.trim();

  if (!email) {
    throw new Error("Owner email is required.");
  }

  if (!isValidBaseBuddyAccountEmail(email)) {
    throw new Error("Enter a real email address.");
  }

  if (!name) {
    throw new Error("Owner name is required.");
  }

  if (!owner.password) {
    throw new Error("Owner password is required.");
  }

  const passwordIssues = getBaseBuddyPasswordIssues(owner.password);

  if (passwordIssues.length > 0) {
    throw new Error(`Use a stronger password: ${passwordIssues.join(" ")}`);
  }

  return {
    email,
    name,
    password: owner.password,
  };
};

const assertInitialSetupEnvReady = () => {
  const env = readBaseBuddyRuntimeEnv();
  const missing: string[] = [];

  if (!env.authSecret || env.authSecret.length < 32) {
    missing.push(`${BASEBUDDY_AUTH_SECRET_ENV} with at least 32 characters`);
  }

  if (!env.contentDatabaseUrl) {
    missing.push(BASEBUDDY_CONTENT_DATABASE_URL_ENV);
  }

  const supabaseValues = [
    env.contentSupabaseUrl,
    env.contentSupabasePublishableKey,
    env.contentSupabaseSecretKey,
  ];

  if (supabaseValues.some(Boolean) && !supabaseValues.every(Boolean)) {
    missing.push(
      `${BASEBUDDY_SUPABASE_URL_ENV}, ${BASEBUDDY_SUPABASE_PUBLISHABLE_KEY_ENV}, and ${BASEBUDDY_SUPABASE_SECRET_KEY_ENV}`,
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Set the required BaseBuddy environment values before creating setup: ${missing.join(", ")}.`,
    );
  }
};

export const createInitialBaseBuddySetup = async ({
  dependencies = {},
  owner,
}: CreateInitialBaseBuddySetupInput): Promise<{
  config: BaseBuddyConfig;
  user: BaseBuddyConfigUser;
}> => {
  assertInitialSetupEnvReady();
  const normalizedOwner = normalizeOwnerInput(owner);
  const now = getIsoNow(dependencies);
  const existingConfig = await loadOptionalBaseBuddyConfig();

  if (existingConfig?.users.length) {
    throw new Error("BaseBuddy setup already has an owner user.");
  }

  await ensureBaseBuddyConfig({
    now,
  });

  const passwordFields = await hashBaseBuddyPassword({
    dependencies,
    password: normalizedOwner.password,
  });
  let createdUser: BaseBuddyConfigUser | null = null;
  const config = await writeBaseBuddyConfig((currentConfig) => {
    if (currentConfig.users.length > 0) {
      throw new Error("BaseBuddy setup already has an owner user.");
    }

    const user: BaseBuddyConfigUser = {
      avatarUrl: null,
      createdAt: now,
      email: normalizedOwner.email,
      id: `user_${getRandomUUID(dependencies)}`,
      name: normalizedOwner.name,
      passwordHash: passwordFields.passwordHash,
      passwordHashParams: passwordFields.passwordHashParams,
      passwordSalt: passwordFields.passwordSalt,
      updatedAt: now,
    };

    createdUser = user;

    return {
      ...currentConfig,
      install: {
        ...currentConfig.install,
        updatedAt: now,
      },
      users: [user],
    };
  });

  if (!createdUser) {
    throw new Error("Could not create the first owner user.");
  }

  await appendBaseBuddyAuditEvent({
    actorEmail: createdUser.email,
    actorUserId: createdUser.id,
    targetEmail: createdUser.email,
    targetUserId: createdUser.id,
    type: "user.create",
  });

  return {
    config,
    user: createdUser,
  };
};
