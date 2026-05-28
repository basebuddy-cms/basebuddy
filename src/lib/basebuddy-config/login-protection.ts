type LoginFailureRecord = {
  failedCount: number;
  lockedUntil: number;
  updatedAt: number;
};

type LoginBackoffDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
const LOGIN_FAILURE_RECORD_TTL_MS = 30 * 60 * 1000;
const STORE_KEY = "__basebuddyLoginProtectionStore";

const getStore = () => {
  const globalScope = globalThis as typeof globalThis & {
    [STORE_KEY]?: Map<string, LoginFailureRecord>;
  };

  globalScope[STORE_KEY] ??= new Map<string, LoginFailureRecord>();
  return globalScope[STORE_KEY];
};

const normalizeKeyPart = (value: string | null | undefined, fallback: string) =>
  value?.trim().toLowerCase() || fallback;

const emailKey = (email: string) => `email:${normalizeKeyPart(email, "unknown")}`;
const ipKey = (ipAddress: string | null | undefined) =>
  `ip:${normalizeKeyPart(ipAddress, "anonymous")}`;

const getActiveRecord = (key: string, now: number) => {
  const record = getStore().get(key);

  if (!record) {
    return null;
  }

  if (record.lockedUntil <= now && now - record.updatedAt > LOGIN_FAILURE_RECORD_TTL_MS) {
    getStore().delete(key);
    return null;
  }

  return record;
};

const getBackoffDecision = (keys: string[], now: number): LoginBackoffDecision => {
  const lockedUntil = keys.reduce((maxLockedUntil, key) => {
    const record = getActiveRecord(key, now);
    return Math.max(maxLockedUntil, record?.lockedUntil ?? 0);
  }, 0);

  if (lockedUntil <= now) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)),
  };
};

export const clearBaseBuddyLoginProtectionStore = () => {
  getStore().clear();
};

export const getBaseBuddyLoginBackoffDecision = ({
  email,
  ipAddress,
  now = Date.now(),
}: {
  email: string;
  ipAddress?: string | null;
  now?: number;
}) => getBackoffDecision([emailKey(email), ipKey(ipAddress)], now);

export const recordBaseBuddyLoginFailure = ({
  email,
  ipAddress,
  now = Date.now(),
}: {
  email: string;
  ipAddress?: string | null;
  now?: number;
}) => {
  for (const key of [emailKey(email), ipKey(ipAddress)]) {
    const existingRecord = getActiveRecord(key, now);
    const failedCount = (existingRecord?.failedCount ?? 0) + 1;
    const lockedUntil =
      failedCount >= LOGIN_FAILURE_LIMIT ? now + LOGIN_LOCKOUT_MS : existingRecord?.lockedUntil ?? 0;

    getStore().set(key, {
      failedCount,
      lockedUntil,
      updatedAt: now,
    });
  }
};

export const recordBaseBuddyLoginSuccess = ({
  email,
  ipAddress,
}: {
  email: string;
  ipAddress?: string | null;
}) => {
  getStore().delete(emailKey(email));
  getStore().delete(ipKey(ipAddress));
};
