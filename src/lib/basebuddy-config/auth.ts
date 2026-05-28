import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import {
  loadBaseBuddyConfig,
  writeBaseBuddyConfig,
} from "@/lib/basebuddy-config/store";
import {
  getBaseBuddyPasswordIssues,
  isValidBaseBuddyAccountEmail,
} from "@/lib/basebuddy-config/account-validation";
import { appendBaseBuddyAuditEvent } from "@/lib/basebuddy-config/audit-log";
import type { BaseBuddyConfig, BaseBuddyConfigUser } from "@/lib/basebuddy-config/schema";
import { requireBaseBuddyAuthSecret } from "@/lib/basebuddy-config/env";

const scryptAsync = promisify(scrypt);

export const BASEBUDDY_SESSION_COOKIE_NAME = "basebuddy_session";
export const BASEBUDDY_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
export const BASEBUDDY_SESSION_TOKEN_BYTES = 32;
export const BASEBUDDY_PASSWORD_HASH_KEY_LENGTH = 64;

export type LocalAuthenticatedUser = Pick<
  BaseBuddyConfigUser,
  "avatarUrl" | "email" | "id" | "name"
>;

export type LocalAuthenticatedSession = {
  user: LocalAuthenticatedUser;
};

type TimeProvider = () => Date | string;

type BaseBuddyPasswordHashDependencies = {
  randomBytes?: (byteCount: number) => Buffer;
};

type BaseBuddyUserCreateDependencies = BaseBuddyPasswordHashDependencies & {
  now?: TimeProvider;
  randomUUID?: () => string;
};

const getNow = (now?: TimeProvider) => {
  const value = now?.() ?? new Date();

  return value instanceof Date ? value : new Date(value);
};

const encodeBase64Url = (value: Buffer | string) =>
  Buffer.isBuffer(value)
    ? value.toString("base64url")
    : Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const hashBaseBuddySessionToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url");

const signSessionToken = ({
  authSecret,
  token,
}: {
  authSecret: string;
  token: string;
}) => createHmac("sha256", authSecret).update(token).digest("base64url");

export const createSignedBaseBuddySessionCookieValue = ({
  authSecret,
  token,
}: {
  authSecret: string;
  token: string;
}) => `${encodeBase64Url(token)}.${signSessionToken({ authSecret, token })}`;

export const parseSignedBaseBuddySessionCookieValue = ({
  authSecret,
  cookieValue,
}: {
  authSecret: string;
  cookieValue: string | null | undefined;
}) => {
  if (!cookieValue) {
    return null;
  }

  const [encodedToken, signature, ...extraParts] = cookieValue.split(".");

  if (!encodedToken || !signature || extraParts.length > 0) {
    return null;
  }

  let token: string;

  try {
    token = decodeBase64Url(encodedToken);
  } catch {
    return null;
  }

  if (!safeEqual(signSessionToken({ authSecret, token }), signature)) {
    return null;
  }

  return token;
};

const getForwardedProtocol = (request: Request) =>
  request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();

export const shouldUseSecureBaseBuddySessionCookie = (request?: Request) => {
  if (!request) {
    return process.env.NODE_ENV === "production";
  }

  const forwardedProtocol = getForwardedProtocol(request);

  if (forwardedProtocol) {
    return forwardedProtocol === "https";
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
};

export const createBaseBuddySessionCookieOptions = ({
  expiresAt,
  secure = process.env.NODE_ENV === "production",
}: {
  expiresAt: Date;
  secure?: boolean;
}) => ({
  expires: expiresAt,
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure,
});

export const createExpiredBaseBuddySessionCookieOptions = ({
  secure = process.env.NODE_ENV === "production",
}: {
  secure?: boolean;
} = {}) => ({
  httpOnly: true,
  maxAge: 0,
  path: "/",
  sameSite: "lax" as const,
  secure,
});

export const verifyBaseBuddyPassword = async ({
  password,
  user,
}: {
  password: string;
  user: Pick<BaseBuddyConfigUser, "passwordHash" | "passwordHashParams" | "passwordSalt">;
}) => {
  if (user.passwordHashParams.name !== "scrypt") {
    return false;
  }

  const hash = (await scryptAsync(
    password,
    user.passwordSalt,
    user.passwordHashParams.keyLength,
  )) as Buffer;

  return safeEqual(hash.toString("base64url"), user.passwordHash);
};

export const hashBaseBuddyPassword = async ({
  dependencies = {},
  password,
}: {
  dependencies?: BaseBuddyPasswordHashDependencies;
  password: string;
}) => {
  const passwordSalt = (dependencies.randomBytes ?? randomBytes)(16).toString("base64url");
  const passwordHash = (await scryptAsync(
    password,
    passwordSalt,
    BASEBUDDY_PASSWORD_HASH_KEY_LENGTH,
  )) as Buffer;

  return {
    passwordHash: passwordHash.toString("base64url"),
    passwordHashParams: {
      keyLength: BASEBUDDY_PASSWORD_HASH_KEY_LENGTH,
      name: "scrypt" as const,
    },
    passwordSalt,
  };
};

const findUserByEmail = (config: BaseBuddyConfig, email: string) =>
  config.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;

const findUserById = (config: BaseBuddyConfig, userId: string) =>
  config.users.find((user) => user.id === userId) ?? null;

const toLocalAuthenticatedUser = (user: BaseBuddyConfigUser): LocalAuthenticatedUser => ({
  avatarUrl: user.avatarUrl,
  email: user.email,
  id: user.id,
  name: user.name,
});

export const createBaseBuddyConfigUser = async ({
  dependencies = {},
  email,
  name,
  password,
}: {
  dependencies?: BaseBuddyUserCreateDependencies;
  email: string;
  name: string;
  password: string;
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const createdAt = getNow(dependencies.now);

  if (!normalizedEmail) {
    throw new Error("Enter an owner email address.");
  }

  if (!isValidBaseBuddyAccountEmail(normalizedEmail)) {
    throw new Error("Enter a real email address.");
  }

  if (!trimmedName) {
    throw new Error("Enter an owner name.");
  }

  if (!password) {
    throw new Error("Enter an owner password.");
  }

  const passwordIssues = getBaseBuddyPasswordIssues(password);

  if (passwordIssues.length > 0) {
    throw new Error(`Use a stronger password: ${passwordIssues.join(" ")}`);
  }

  const passwordFields = await hashBaseBuddyPassword({
    dependencies,
    password,
  });
  let createdUser: BaseBuddyConfigUser | null = null;

  const config = await writeBaseBuddyConfig((currentConfig) => {
    const existingUser = findUserByEmail(currentConfig, normalizedEmail);

    if (existingUser) {
      throw new Error("A local user with that email already exists.");
    }

    const now = createdAt.toISOString();
    const nextUser: BaseBuddyConfigUser = {
      avatarUrl: null,
      createdAt: now,
      email: normalizedEmail,
      id: `user_${(dependencies.randomUUID ?? randomUUID)()}`,
      name: trimmedName,
      passwordHash: passwordFields.passwordHash,
      passwordHashParams: passwordFields.passwordHashParams,
      passwordSalt: passwordFields.passwordSalt,
      updatedAt: now,
    };

    createdUser = nextUser;

    return {
      ...currentConfig,
      install: {
        ...currentConfig.install,
        updatedAt: now,
      },
      users: [...currentConfig.users, nextUser],
    };
  });

  const user = createdUser ?? findUserByEmail(config, normalizedEmail);

  if (user) {
    await appendBaseBuddyAuditEvent({
      actorEmail: user.email,
      actorUserId: user.id,
      targetEmail: user.email,
      targetUserId: user.id,
      type: "user.create",
    });
  }

  return user;
};

export const authenticateBaseBuddyConfigUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return null;
  }

  const config = await loadBaseBuddyConfig();
  const user = findUserByEmail(config, normalizedEmail);

  if (!user) {
    return null;
  }

  const passwordMatches = await verifyBaseBuddyPassword({
    password,
    user,
  });

  return passwordMatches ? user : null;
};

export const createBaseBuddyConfigSession = async ({
  now,
  userId,
}: {
  now?: TimeProvider;
  userId: string;
}) => {
  const rawToken = randomBytes(BASEBUDDY_SESSION_TOKEN_BYTES).toString("base64url");
  const createdAt = getNow(now);
  const expiresAt = new Date(createdAt.getTime() + BASEBUDDY_SESSION_DURATION_MS);
  const sessionId = `session_${randomBytes(16).toString("base64url")}`;

  await writeBaseBuddyConfig((currentConfig) => {
    const currentTime = createdAt.getTime();

    return {
      ...currentConfig,
      install: {
        ...currentConfig.install,
        updatedAt: createdAt.toISOString(),
      },
      sessions: [
        ...currentConfig.sessions.filter(
          (session) => new Date(session.expiresAt).getTime() > currentTime,
        ),
        {
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          id: sessionId,
          lastSeenAt: createdAt.toISOString(),
          tokenHash: hashBaseBuddySessionToken(rawToken),
          userId,
        },
      ],
    };
  });

  return {
    cookieValue: createSignedBaseBuddySessionCookieValue({
      authSecret: requireBaseBuddyAuthSecret(),
      token: rawToken,
    }),
    expiresAt,
    sessionId,
  };
};

export const getBaseBuddyConfigSessionByToken = async ({
  now,
  token,
}: {
  now?: TimeProvider;
  token: string;
}): Promise<LocalAuthenticatedSession | null> => {
  const tokenHash = hashBaseBuddySessionToken(token);
  const config = await loadBaseBuddyConfig();
  const currentTime = getNow(now).getTime();
  const expiredSessionIds = new Set(
    config.sessions
      .filter((session) => new Date(session.expiresAt).getTime() <= currentTime)
      .map((session) => session.id),
  );
  const session = config.sessions.find(
    (candidate) =>
      candidate.tokenHash === tokenHash &&
      !expiredSessionIds.has(candidate.id),
  );

  if (expiredSessionIds.size > 0) {
    await writeBaseBuddyConfig((currentConfig) => ({
      ...currentConfig,
      sessions: currentConfig.sessions.filter(
        (candidate) => !expiredSessionIds.has(candidate.id),
      ),
    }));
  }

  if (!session) {
    return null;
  }

  const user = findUserById(config, session.userId);

  if (!user) {
    return null;
  }

  return {
    user: toLocalAuthenticatedUser(user),
  };
};

export const removeBaseBuddyConfigSessionByToken = async (token: string | null) => {
  if (!token) {
    return;
  }

  const tokenHash = hashBaseBuddySessionToken(token);

  await writeBaseBuddyConfig((config) => ({
    ...config,
    sessions: config.sessions.filter((session) => session.tokenHash !== tokenHash),
  }));
};

export const updateBaseBuddyConfigUserProfile = async ({
  avatarUrl,
  name,
  userId,
}: {
  avatarUrl?: string | null;
  name: string;
  userId: string;
}): Promise<LocalAuthenticatedUser> => {
  const now = new Date().toISOString();
  const trimmedName = name.trim();
  let updatedUser: LocalAuthenticatedUser | null = null;

  if (!trimmedName) {
    throw new Error("Enter a profile name first.");
  }

  await writeBaseBuddyConfig((config) => ({
    ...config,
    install: {
      ...config.install,
      updatedAt: now,
    },
    users: config.users.map((user) => {
      if (user.id !== userId) {
        return user;
      }

      const nextUser = {
        ...user,
        avatarUrl: avatarUrl === undefined ? user.avatarUrl : avatarUrl,
        name: trimmedName,
        updatedAt: now,
      };

      updatedUser = toLocalAuthenticatedUser(nextUser);
      return nextUser;
    }),
  }));

  if (!updatedUser) {
    throw new Error("Could not find your profile in the BaseBuddy config file.");
  }

  await appendBaseBuddyAuditEvent({
    actorUserId: userId,
    targetUserId: userId,
    type: "user.profile.update",
  });

  return updatedUser;
};
