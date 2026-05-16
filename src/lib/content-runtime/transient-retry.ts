import { getRawErrorMessage } from "@/lib/errors/user-facing";

const CONTENT_RUNTIME_TRANSIENT_ERROR_PATTERNS = [
  /responding too slowly right now/i,
  /temporarily switched this project into a degraded state/i,
  /having trouble reaching this project's content right now/i,
  /install database is busy right now/i,
  /install database connection is temporarily unavailable/i,
  /\bETIMEDOUT\b/i,
  /statement timeout/i,
  /query[_ ]timeout/i,
  /Connection terminated due to connection timeout/i,
  /\btimed out\b/i,
  /^Could not (?:load|manage|create)[^.]* right now\.$/i,
] as const;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const isContentRuntimeTransientError = (error: unknown) => {
  const message = getRawErrorMessage(error);

  if (!message) {
    return false;
  }

  return CONTENT_RUNTIME_TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

export const retryContentRuntimeTransientErrors = async <T>(
  operation: () => Promise<T>,
  {
    delayMs = 750,
    maxAttempts = 2,
  }: {
    delayMs?: number | ((attempt: number) => number);
    maxAttempts?: number;
  } = {},
): Promise<T> => {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isContentRuntimeTransientError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const nextDelayMs = typeof delayMs === "function" ? delayMs(attempt) : delayMs;
      await sleep(nextDelayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not complete the request right now.");
};
