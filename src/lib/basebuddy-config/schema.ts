import { z } from "zod";

import { DEFAULT_PROJECT_PERMISSION_DEFINITIONS } from "@/lib/control-plane/member-permissions";
import { PROJECT_ROLES } from "@/lib/control-plane/utils";
import { fingerprintSecret, redactDatabaseUrl } from "./env";

export const BASEBUDDY_CONFIG_VERSION = 1;

const isoDateStringSchema = z.string().datetime({ offset: true });
const nullableUrlStringSchema = z.string().trim().min(1).nullable();
const projectRoleSchema = z.enum(PROJECT_ROLES);
const permissionKeySchema = z.enum(
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS.map((permission) => permission.permissionKey) as [
    string,
    ...string[],
  ],
);

const contentProviderSchema = z.literal("postgres");

export const baseBuddyConfigInstallSchema = z.object({
  content: z.object({
    provider: contentProviderSchema,
  }).strict(),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
}).strict();

export const baseBuddyConfigPasswordHashParamsSchema = z.object({
  keyLength: z.number().int().positive(),
  name: z.literal("scrypt"),
});

export const baseBuddyConfigUserSchema = z.object({
  avatarUrl: nullableUrlStringSchema,
  createdAt: isoDateStringSchema,
  email: z.string().trim().email(),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  passwordHash: z.string().min(1),
  passwordHashParams: baseBuddyConfigPasswordHashParamsSchema,
  passwordSalt: z.string().min(1),
  updatedAt: isoDateStringSchema,
});

export const baseBuddyConfigSessionSchema = z.object({
  createdAt: isoDateStringSchema,
  expiresAt: isoDateStringSchema,
  id: z.string().trim().min(1),
  lastSeenAt: isoDateStringSchema,
  tokenHash: z.string().min(1),
  userId: z.string().trim().min(1),
});

export const baseBuddyConfigAuthorScopeSchema = z.object({
  canPublish: z.boolean().optional(),
  cmsAuthorId: z.string().trim().min(1),
});

export const baseBuddyConfigProjectMemberSchema = z.object({
  allowPermissionKeys: z.array(permissionKeySchema),
  authorScopes: z.array(baseBuddyConfigAuthorScopeSchema),
  denyPermissionKeys: z.array(permissionKeySchema),
  joinedAt: isoDateStringSchema,
  roles: z.array(projectRoleSchema),
  userId: z.string().trim().min(1),
});

export const baseBuddyConfigMappingRevisionSchema = z.object({
  bindingStatus: z.enum(["draft", "ready", "invalid", "archived"]),
  createdAt: isoDateStringSchema,
  id: z.string().trim().min(1),
  mappingConfig: z.record(z.string(), z.unknown()),
  source: z.enum(["auto_detect", "manual", "system"]),
  version: z.number().int().positive(),
});

export const baseBuddyConfigSidebarRevisionSchema = z.object({
  config: z.record(z.string(), z.unknown()),
  createdAt: isoDateStringSchema,
  id: z.string().trim().min(1),
  source: z.enum(["manual", "system"]),
  version: z.number().int().positive(),
});

export const baseBuddyConfigProjectSchema = z.object({
  createdAt: isoDateStringSchema,
  createdBy: z.string().trim().min(1),
  id: z.string().trim().min(1),
  mapping: z.unknown().nullable(),
  mappingRevisions: z.array(baseBuddyConfigMappingRevisionSchema),
  members: z.array(baseBuddyConfigProjectMemberSchema),
  name: z.string().trim().min(1),
  sidebar: z.unknown().nullable(),
  sidebarRevisions: z.array(baseBuddyConfigSidebarRevisionSchema),
  slug: z.string().trim().min(1),
  status: z.enum(["active", "archived"]),
  updatedAt: isoDateStringSchema,
  websiteUrl: nullableUrlStringSchema,
});

export const baseBuddyConfigInvitationSchema = z.object({
  acceptedAt: isoDateStringSchema.nullable(),
  acceptedBy: z.string().trim().min(1).nullable(),
  authorScopes: z.array(baseBuddyConfigAuthorScopeSchema),
  createdAt: isoDateStringSchema,
  createdBy: z.string().trim().min(1),
  expiresAt: isoDateStringSchema,
  id: z.string().trim().min(1),
  invitedEmail: z.string().trim().email(),
  projectId: z.string().trim().min(1),
  publicToken: z.string().trim().min(16),
  revokedAt: isoDateStringSchema.nullable(),
  revokedBy: z.string().trim().min(1).nullable(),
  roles: z.array(projectRoleSchema),
});

export const baseBuddyConfigSchema = z.object({
  install: baseBuddyConfigInstallSchema,
  invitations: z.array(baseBuddyConfigInvitationSchema),
  projects: z.array(baseBuddyConfigProjectSchema),
  sessions: z.array(baseBuddyConfigSessionSchema),
  users: z.array(baseBuddyConfigUserSchema),
  version: z.literal(BASEBUDDY_CONFIG_VERSION),
});

export type BaseBuddyConfig = z.infer<typeof baseBuddyConfigSchema>;
export type BaseBuddyConfigInstall = z.infer<typeof baseBuddyConfigInstallSchema>;
export type BaseBuddyConfigInvitation = z.infer<typeof baseBuddyConfigInvitationSchema>;
export type BaseBuddyConfigProject = z.infer<typeof baseBuddyConfigProjectSchema>;
export type BaseBuddyConfigProjectMember = z.infer<typeof baseBuddyConfigProjectMemberSchema>;
export type BaseBuddyConfigUser = z.infer<typeof baseBuddyConfigUserSchema>;

export type CreateDefaultBaseBuddyConfigInput = {
  content?: Partial<BaseBuddyConfigInstall["content"]>;
  now?: string;
};

export const createDefaultBaseBuddyConfig = ({
  content = {},
  now = new Date().toISOString(),
}: CreateDefaultBaseBuddyConfigInput): BaseBuddyConfig =>
  baseBuddyConfigSchema.parse({
    install: {
      content: {
        provider: content.provider ?? "postgres",
      },
      createdAt: now,
      updatedAt: now,
    },
    invitations: [],
    projects: [],
    sessions: [],
    users: [],
    version: BASEBUDDY_CONFIG_VERSION,
  });

const shouldRedactKey = (key: string) =>
  /authSecret|secret|password|token|hash|salt|accessKey|publishableKey/i.test(key);

const redactValue = (key: string, value: unknown): unknown => {
  if (typeof value === "string") {
    if (key === "databaseUrl" && value) {
      return redactDatabaseUrl(value);
    }

    if (shouldRedactKey(key) && value) {
      return fingerprintSecret(value);
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue),
      ]),
    );
  }

  return value;
};

export const redactBaseBuddyConfig = (config: BaseBuddyConfig) =>
  redactValue("config", config) as BaseBuddyConfig;

export const formatBaseBuddyConfigValidationError = (error: z.ZodError) =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
