import { randomUUID } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

export const BASEBUDDY_AUDIT_LOG_FILENAME = "basebuddy.audit.jsonl";

export type BaseBuddyAuditEventType =
  | "auth.login.failure"
  | "auth.login.success"
  | "auth.logout"
  | "user.create"
  | "user.profile.update";

export type BaseBuddyAuditEventInput = {
  actorEmail?: string | null;
  actorUserId?: string | null;
  ipAddress?: string | null;
  targetEmail?: string | null;
  targetUserId?: string | null;
  type: BaseBuddyAuditEventType;
  userAgent?: string | null;
};

const normalizeOptionalString = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue || null;
};

export const getBaseBuddyAuditLogPath = () =>
  join(process.cwd(), BASEBUDDY_AUDIT_LOG_FILENAME);

export const appendBaseBuddyAuditEvent = async ({
  actorEmail = null,
  actorUserId = null,
  ipAddress = null,
  targetEmail = null,
  targetUserId = null,
  type,
  userAgent = null,
}: BaseBuddyAuditEventInput) => {
  const event = {
    actorEmail: normalizeOptionalString(actorEmail),
    actorUserId: normalizeOptionalString(actorUserId),
    createdAt: new Date().toISOString(),
    id: `audit_${randomUUID()}`,
    ipAddress: normalizeOptionalString(ipAddress),
    targetEmail: normalizeOptionalString(targetEmail),
    targetUserId: normalizeOptionalString(targetUserId),
    type,
    userAgent: normalizeOptionalString(userAgent),
  };

  await appendFile(getBaseBuddyAuditLogPath(), `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return event;
};
