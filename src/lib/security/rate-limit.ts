type FixedWindowRateLimitRecord = {
  count: number;
  resetAt: number;
};

export type FixedWindowRateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type FixedWindowRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const RATE_LIMIT_STORE_KEY = "__basebuddyFixedWindowRateLimitStore";

// This limiter is process-local. Production installs should keep a reverse proxy
// rate limit in front of BaseBuddy, and multi-process deployments need a shared
// limiter store if strict cross-instance limits are required.
const getRateLimitStore = () => {
  const globalScope = globalThis as typeof globalThis & {
    [RATE_LIMIT_STORE_KEY]?: Map<string, FixedWindowRateLimitRecord>;
  };

  globalScope[RATE_LIMIT_STORE_KEY] ??= new Map<string, FixedWindowRateLimitRecord>();
  return globalScope[RATE_LIMIT_STORE_KEY];
};

export const clearFixedWindowRateLimitStore = () => {
  getRateLimitStore().clear();
};

const pruneExpiredRateLimitEntries = (
  store: Map<string, FixedWindowRateLimitRecord>,
  now: number,
) => {
  if (store.size < 500) {
    return;
  }

  for (const [key, record] of store.entries()) {
    if (record.resetAt <= now) {
      store.delete(key);
    }
  }
};

export const createFixedWindowRateLimiter = ({
  now = () => Date.now(),
}: {
  now?: () => number;
} = {}) => ({
  consume({
    key,
    limit,
    windowMs,
  }: FixedWindowRateLimitOptions): FixedWindowRateLimitDecision {
    const store = getRateLimitStore();
    const currentTime = now();

    pruneExpiredRateLimitEntries(store, currentTime);

    const existingRecord = store.get(key);
    const activeRecord =
      existingRecord && existingRecord.resetAt > currentTime
        ? existingRecord
        : {
            count: 0,
            resetAt: currentTime + windowMs,
          };

    activeRecord.count += 1;
    store.set(key, activeRecord);

    const allowed = activeRecord.count <= limit;
    const remaining = Math.max(0, limit - activeRecord.count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((activeRecord.resetAt - currentTime) / 1000),
    );

    return {
      allowed,
      limit,
      remaining,
      resetAt: activeRecord.resetAt,
      retryAfterSeconds,
    };
  },
});

const defaultRateLimiter = createFixedWindowRateLimiter();

export const consumeFixedWindowRateLimit = (options: FixedWindowRateLimitOptions) =>
  defaultRateLimiter.consume(options);
