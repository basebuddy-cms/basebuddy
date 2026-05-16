import { createHash } from "node:crypto";

export const CONTENT_PLANE_CONNECTION_TIMEOUT_MS = 5_000;
export const CONTENT_PLANE_QUERY_TIMEOUT_MS = 10_000;
export const CONTENT_PLANE_STATEMENT_TIMEOUT_MS = 10_000;
export const CONTENT_PLANE_DEGRADED_DATABASE_COOLDOWN_MS = 5_000;

const contentPlaneDatabaseTimeoutPatterns = [
  /\bETIMEDOUT\b/i,
  /\btimeout\b/i,
  /statement timeout/i,
  /query[_ ]timeout/i,
  /timed out/i,
  /Connection terminated due to connection timeout/i,
];

export const CONTENT_PLANE_DEGRADED_DATABASE_MESSAGE =
  "BaseBuddy is having trouble reaching this project's content right now. Try again in a few seconds.";

type ContentPlaneDatabaseDegradedCircuit = {
  cooldownUntil: number;
};

const contentPlaneDegradedDatabaseCircuits = new Map<string, ContentPlaneDatabaseDegradedCircuit>();

const getContentPlaneDatabaseCircuitKey = (connectionIdentity: string) =>
  createHash("sha1").update(connectionIdentity).digest("hex");

const getOpenContentPlaneDatabaseCircuit = (connectionIdentity: string) => {
  const circuitKey = getContentPlaneDatabaseCircuitKey(connectionIdentity);
  const circuit = contentPlaneDegradedDatabaseCircuits.get(circuitKey);

  if (!circuit) {
    return null;
  }

  if (circuit.cooldownUntil <= Date.now()) {
    contentPlaneDegradedDatabaseCircuits.delete(circuitKey);
    return null;
  }

  return circuit;
};

export const isContentPlaneDatabaseTimeoutLikeError = (message: string) =>
  contentPlaneDatabaseTimeoutPatterns.some((pattern) => pattern.test(message));

export const getContentPlaneDegradedDatabaseMessage = () =>
  CONTENT_PLANE_DEGRADED_DATABASE_MESSAGE;

export const assertContentPlaneDatabaseCircuitClosed = (connectionIdentity: string) => {
  if (getOpenContentPlaneDatabaseCircuit(connectionIdentity)) {
    throw new Error(getContentPlaneDegradedDatabaseMessage());
  }
};

export const noteContentPlaneDatabaseFailure = (
  connectionIdentity: string,
  error: unknown,
) => {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (!isContentPlaneDatabaseTimeoutLikeError(message)) {
    return;
  }

  contentPlaneDegradedDatabaseCircuits.set(getContentPlaneDatabaseCircuitKey(connectionIdentity), {
    cooldownUntil: Date.now() + CONTENT_PLANE_DEGRADED_DATABASE_COOLDOWN_MS,
  });
};

export const noteContentPlaneDatabaseSuccess = (connectionIdentity: string) => {
  contentPlaneDegradedDatabaseCircuits.delete(getContentPlaneDatabaseCircuitKey(connectionIdentity));
};

export const resetContentPlaneDatabaseDegradedCircuit = (connectionIdentity?: string) => {
  if (connectionIdentity) {
    contentPlaneDegradedDatabaseCircuits.delete(getContentPlaneDatabaseCircuitKey(connectionIdentity));
    return;
  }

  contentPlaneDegradedDatabaseCircuits.clear();
};
