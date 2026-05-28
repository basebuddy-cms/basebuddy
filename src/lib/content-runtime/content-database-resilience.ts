import { createHash } from "node:crypto";

export const CONTENT_DATABASE_CONNECTION_TIMEOUT_MS = 5_000;
export const CONTENT_DATABASE_QUERY_TIMEOUT_MS = 10_000;
export const CONTENT_DATABASE_STATEMENT_TIMEOUT_MS = 10_000;
export const CONTENT_DATABASE_DEGRADED_COOLDOWN_MS = 5_000;

const contentDatabaseTimeoutPatterns = [
  /\bETIMEDOUT\b/i,
  /\btimeout\b/i,
  /statement timeout/i,
  /query[_ ]timeout/i,
  /timed out/i,
  /Connection terminated due to connection timeout/i,
];

export const CONTENT_DATABASE_DEGRADED_MESSAGE =
  "BaseBuddy is having trouble reaching this project's content right now. Try again in a few seconds.";

type ContentDatabaseDegradedCircuit = {
  cooldownUntil: number;
};

const contentDatabaseDegradedCircuits = new Map<string, ContentDatabaseDegradedCircuit>();

const getContentDatabaseCircuitKey = (connectionIdentity: string) =>
  createHash("sha1").update(connectionIdentity).digest("hex");

const getOpenContentDatabaseCircuit = (connectionIdentity: string) => {
  const circuitKey = getContentDatabaseCircuitKey(connectionIdentity);
  const circuit = contentDatabaseDegradedCircuits.get(circuitKey);

  if (!circuit) {
    return null;
  }

  if (circuit.cooldownUntil <= Date.now()) {
    contentDatabaseDegradedCircuits.delete(circuitKey);
    return null;
  }

  return circuit;
};

export const isContentDatabaseTimeoutLikeError = (message: string) =>
  contentDatabaseTimeoutPatterns.some((pattern) => pattern.test(message));

export const getContentDegradedDatabaseMessage = () =>
  CONTENT_DATABASE_DEGRADED_MESSAGE;

export const assertContentDatabaseCircuitClosed = (connectionIdentity: string) => {
  if (getOpenContentDatabaseCircuit(connectionIdentity)) {
    throw new Error(getContentDegradedDatabaseMessage());
  }
};

export const noteContentDatabaseFailure = (
  connectionIdentity: string,
  error: unknown,
) => {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (!isContentDatabaseTimeoutLikeError(message)) {
    return;
  }

  contentDatabaseDegradedCircuits.set(getContentDatabaseCircuitKey(connectionIdentity), {
    cooldownUntil: Date.now() + CONTENT_DATABASE_DEGRADED_COOLDOWN_MS,
  });
};

export const noteContentDatabaseSuccess = (connectionIdentity: string) => {
  contentDatabaseDegradedCircuits.delete(getContentDatabaseCircuitKey(connectionIdentity));
};

export const resetContentDatabaseDegradedCircuit = (connectionIdentity?: string) => {
  if (connectionIdentity) {
    contentDatabaseDegradedCircuits.delete(getContentDatabaseCircuitKey(connectionIdentity));
    return;
  }

  contentDatabaseDegradedCircuits.clear();
};
