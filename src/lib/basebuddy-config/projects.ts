import { randomUUID } from "node:crypto";

import type { ProjectMemberAccess, ProjectPermissionKey } from "@/lib/control-plane/permissions";
import {
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS,
  DEFAULT_PROJECT_ROLE_PERMISSION_KEYS,
  type ProjectPermissionDefinition,
  type ProjectPermissionMemberRecord,
} from "@/lib/control-plane/member-permissions";
import {
  getEffectivePermissionKeys,
  normalizePermissionKeys,
} from "@/lib/control-plane/member-permission-overrides";
import {
  DEFAULT_PROJECT_ROLE_DEFINITIONS,
  normalizeProjectMemberAuthorScopeCanPublish,
  type ProjectMemberAuthorScope,
  type ProjectMemberRecord,
} from "@/lib/control-plane/members";
import type {
  ProjectAuthorAssignment,
  ProjectAuthorMember,
} from "@/lib/control-plane/authors";
import {
  buildProjectMemberInvitationPath,
  getProjectMemberInvitationStatus,
  normalizeProjectMemberInvitationEmail,
  type AcceptProjectMemberInvitationResult,
  type ProjectMemberInvitationPreview,
  type ProjectMemberInvitationRecord,
  type ProjectMemberInvitationsPayload,
} from "@/lib/control-plane/member-invitations";
import {
  getHighestProjectRole,
  normalizeProjectSlug,
  type ProjectRole,
} from "@/lib/control-plane/utils";
import {
  type ContentBindingStatus,
  type ContentMappingConfig,
  type ContentMappingRevisionSource,
  type ContentProjectMapping,
  createDefaultContentMappingConfig,
  normalizeContentMappingConfig,
  normalizeContentProjectMapping,
} from "@/lib/content-runtime/mapping";
import {
  createDefaultContentPostSidebarConfig,
  normalizeContentPostSidebarConfig,
  type ContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";

import type {
  BaseBuddyConfig,
  BaseBuddyConfigInvitation,
  BaseBuddyConfigProject,
  BaseBuddyConfigProjectMember,
  BaseBuddyConfigUser,
} from "./schema";
import { loadBaseBuddyConfig, writeBaseBuddyConfig } from "./store";

export type ConfigProjectSummary = {
  createdAt: string;
  id: string;
  name: string;
  role: ProjectRole;
  slug: string;
  websiteUrl: string | null;
};

export type ConfigProjectAccessContext = {
  memberAccess: ProjectMemberAccess;
  project: ConfigProjectSummary;
};

type ConfigProjectListResult = {
  hasMoreProjects: boolean;
  projectSearchQuery: string;
  projects: ConfigProjectSummary[];
  setupRequired: boolean;
};

type ConfigProjectResult = {
  errorMessage?: string;
  project: ConfigProjectSummary | null;
  setupRequired: boolean;
};

type CreateConfigProjectInput = {
  name: string;
  slug: string;
  userId: string;
};

type UpdateConfigProjectMetadataInput = {
  name: string;
  projectId: string;
  slug: string;
  websiteUrl: string | null;
};

type SaveConfigProjectContentMappingRevisionInput = {
  bindingStatus?: ContentBindingStatus | null;
  mappingConfig: ContentMappingConfig;
  projectId: string;
  source?: ContentMappingRevisionSource;
};

type SaveConfigProjectPostSidebarConfigInput = {
  config: ContentPostSidebarConfig;
  projectId: string;
  source?: "manual" | "system";
};

type ListConfigProjectMembersInput = {
  currentUserId: string;
  page?: number;
  pageSize?: number;
  projectId: string;
};

type MutateConfigProjectMemberInput = {
  actorUserId: string;
  authorScopes: ProjectMemberAuthorScope[];
  projectId: string;
  roles: string[];
  userId: string;
};

type AddConfigProjectMemberInput = Omit<MutateConfigProjectMemberInput, "userId"> & {
  email: string;
};

type RemoveConfigProjectMemberInput = {
  actorUserId: string;
  projectId: string;
  userId: string;
};

type SetConfigProjectMemberPermissionOverridesInput = {
  actorUserId: string;
  allowPermissionKeys: string[];
  denyPermissionKeys: string[];
  projectId: string;
  userId: string;
};

type SetConfigProjectAuthorAssignmentInput = {
  actorUserId: string;
  canPublish?: boolean;
  cmsAuthorId: string;
  projectId: string;
  userId: string | null;
};

type ListConfigProjectMemberInvitationsInput = {
  actorUserId: string;
  page?: number;
  pageSize?: number;
  projectId: string;
};

type CreateConfigProjectMemberInvitationInput = {
  actorUserId: string;
  authorScopes: ProjectMemberAuthorScope[];
  email: string;
  expiresAt?: string | null;
  projectId: string;
  publicToken: string;
  roles: string[];
};

type RevokeConfigProjectMemberInvitationInput = {
  actorUserId: string;
  invitationId: string;
  projectId: string;
};

type AcceptConfigProjectMemberInvitationInput = {
  publicToken: string;
  userEmail: string | null | undefined;
  userId: string;
};

export type ConfigProjectMembersPayload = {
  currentRoleKeys: ProjectRole[];
  hasMoreMembers: boolean;
  memberAccess: ProjectMemberAccess;
  memberPage: number;
  memberPageSize: number;
  members: ProjectMemberRecord[];
};

export type ConfigProjectPermissionsPayload = {
  currentUserId: string;
  members: ProjectPermissionMemberRecord[];
  permissions: ProjectPermissionDefinition[];
};

export type ConfigProjectPostAuthorAssignment = {
  avatar_url: string | null;
  cms_author_id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
};

const PROJECTS_PAGE_SIZE = 48;

export class ConfigProjectSlugConflictError extends Error {
  constructor(message = "That project address is already taken.") {
    super(message);
    this.name = "ConfigProjectSlugConflictError";
  }
}

export class ConfigProjectNotFoundError extends Error {
  constructor(message = "Could not find that project.") {
    super(message);
    this.name = "ConfigProjectNotFoundError";
  }
}

const normalizeProjectMemberRoles = (roles: readonly string[]) =>
  [...new Set(roles)].filter((role): role is ProjectRole =>
    Boolean(getHighestProjectRole([role])),
  );

const normalizeProjectListLimit = (value: number | null | undefined) =>
  Number.isFinite(value) && value && value > 0
    ? Math.min(Math.floor(value), 100)
    : PROJECTS_PAGE_SIZE;

const normalizeProjectListSearchQuery = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);

const getCurrentTimestamp = () => new Date().toISOString();

const createConfigId = () => randomUUID();

const permissionCategoryOrder: Record<ProjectPermissionDefinition["category"], number> = {
  project: 0,
  member: 1,
  content: 2,
  author: 3,
  mapping: 4,
  integration: 5,
};

const normalizedPermissionDefinitionKeys = new Set(
  DEFAULT_PROJECT_PERMISSION_DEFINITIONS.map((permission) => permission.permissionKey),
);

const isProjectOwner = (member: Pick<BaseBuddyConfigProjectMember, "roles"> | null | undefined) =>
  Boolean(member?.roles.includes("owner"));

const getConfigProjectById = (config: BaseBuddyConfig, projectId: string) => {
  const project = config.projects.find((candidate) => candidate.id === projectId) ?? null;

  if (!project) {
    throw new ConfigProjectNotFoundError();
  }

  return project;
};

const getConfigProjectMember = ({
  project,
  userId,
}: {
  project: BaseBuddyConfigProject;
  userId: string;
}) => {
  const member = project.members.find((candidate) => candidate.userId === userId) ?? null;

  if (!member) {
    throw new Error("Project member not found.");
  }

  return member;
};

const getConfigUserById = ({
  config,
  userId,
}: {
  config: BaseBuddyConfig;
  userId: string;
}) => config.users.find((candidate) => candidate.id === userId) ?? null;

const getConfigUserByEmail = ({
  config,
  email,
}: {
  config: BaseBuddyConfig;
  email: string;
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  return config.users.find((candidate) => candidate.email.trim().toLowerCase() === normalizedEmail) ?? null;
};

const normalizeConfigAuthorScopes = (
  authorScopes: readonly { canPublish?: boolean; cmsAuthorId?: string }[],
): ProjectMemberAuthorScope[] => {
  const scopesByAuthorId = new Map<string, ProjectMemberAuthorScope>();

  for (const scope of authorScopes) {
    const cmsAuthorId = scope.cmsAuthorId.trim();

    if (!cmsAuthorId) {
      continue;
    }

    scopesByAuthorId.set(cmsAuthorId, {
      canPublish: normalizeProjectMemberAuthorScopeCanPublish(scope.canPublish),
      cmsAuthorId,
    });
  }

  return [...scopesByAuthorId.values()];
};

const normalizeConfigProjectRoles = (roles: readonly string[]) => {
  const roleOrder = new Map(DEFAULT_PROJECT_ROLE_DEFINITIONS.map((role, index) => [role.roleKey, index]));
  const normalizedRoles = normalizeProjectMemberRoles(roles).sort(
    (left, right) => (roleOrder.get(left) ?? 999) - (roleOrder.get(right) ?? 999),
  );

  if (!normalizedRoles.length) {
    throw new Error("Select at least one role.");
  }

  return normalizedRoles;
};

const normalizeConfigPermissionOverrides = (permissionKeys: readonly string[]) =>
  normalizePermissionKeys(permissionKeys).filter((permissionKey) =>
    normalizedPermissionDefinitionKeys.has(permissionKey),
  );

const toProjectMemberRecord = ({
  member,
  user,
}: {
  member: BaseBuddyConfigProjectMember;
  user: BaseBuddyConfigUser | null;
}): ProjectMemberRecord => ({
  authorScopes: normalizeConfigAuthorScopes(member.authorScopes),
  avatarUrl: user?.avatarUrl ?? null,
  email: user?.email ?? null,
  joinedAt: member.joinedAt,
  name: user?.name ?? null,
  roles: normalizeProjectMemberRoles(member.roles),
  userId: member.userId,
});

const getInheritedPermissionKeysForRoles = (roles: readonly string[]) =>
  normalizePermissionKeys(
    normalizeProjectMemberRoles(roles).flatMap((role) => DEFAULT_PROJECT_ROLE_PERMISSION_KEYS[role] ?? []),
  );

const toProjectPermissionMemberRecord = ({
  member,
  user,
}: {
  member: BaseBuddyConfigProjectMember;
  user: BaseBuddyConfigUser | null;
}): ProjectPermissionMemberRecord => {
  const inheritedPermissionKeys = getInheritedPermissionKeysForRoles(member.roles);
  const allowPermissionKeys = normalizeConfigPermissionOverrides(member.allowPermissionKeys);
  const denyPermissionKeys = normalizeConfigPermissionOverrides(member.denyPermissionKeys);

  return {
    allowPermissionKeys,
    avatarUrl: user?.avatarUrl ?? null,
    denyPermissionKeys,
    effectivePermissionKeys: getEffectivePermissionKeys({
      allowPermissionKeys,
      denyPermissionKeys,
      inheritedPermissionKeys,
    }),
    email: user?.email ?? null,
    inheritedPermissionKeys,
    joinedAt: member.joinedAt,
    name: user?.name ?? null,
    roles: normalizeProjectMemberRoles(member.roles),
    userId: member.userId,
  };
};

const getSortedProjectPermissionDefinitions = () =>
  [...DEFAULT_PROJECT_PERMISSION_DEFINITIONS].sort((left, right) => {
    const categoryDifference = permissionCategoryOrder[left.category] - permissionCategoryOrder[right.category];

    if (categoryDifference !== 0) {
      return categoryDifference;
    }

    return left.label.localeCompare(right.label);
  });

const assertMemberHasPermission = ({
  member,
  message,
  permissionKey,
}: {
  member: BaseBuddyConfigProjectMember;
  message: string;
  permissionKey: ProjectPermissionKey;
}) => {
  const access = getConfigProjectMemberAccess(member);

  if (!access.permissions.includes(permissionKey)) {
    throw new Error(message);
  }
};

const countProjectOwners = (project: BaseBuddyConfigProject) =>
  project.members.filter((member) => isProjectOwner(member)).length;

const assertOwnerRoleMutationAllowed = ({
  actorMember,
  nextRoles,
  project,
  targetMember,
}: {
  actorMember: BaseBuddyConfigProjectMember;
  nextRoles: readonly ProjectRole[];
  project: BaseBuddyConfigProject;
  targetMember: BaseBuddyConfigProjectMember;
}) => {
  const actorIsOwner = isProjectOwner(actorMember);
  const targetIsOwner = isProjectOwner(targetMember);
  const nextIsOwner = nextRoles.includes("owner");

  if (!actorIsOwner && (targetIsOwner || nextIsOwner)) {
    throw new Error("Not authorized to change owner memberships.");
  }

  if (targetIsOwner && !nextIsOwner && countProjectOwners(project) <= 1) {
    throw new Error("At least one owner is required.");
  }
};

const assertOwnerRemovalAllowed = ({
  actorMember,
  project,
  targetMember,
}: {
  actorMember: BaseBuddyConfigProjectMember;
  project: BaseBuddyConfigProject;
  targetMember: BaseBuddyConfigProjectMember;
}) => {
  if (!isProjectOwner(actorMember) && isProjectOwner(targetMember)) {
    throw new Error("Not authorized to remove owner memberships.");
  }

  if (isProjectOwner(targetMember) && countProjectOwners(project) <= 1) {
    throw new Error("At least one owner is required.");
  }
};

const assertAtLeastOneMemberCanManageMembers = (project: BaseBuddyConfigProject) => {
  const hasManager = project.members.some((member) =>
    getConfigProjectMemberAccess(member).permissions.includes("member.manage"),
  );

  if (!hasManager) {
    throw new Error("At least one member must keep permission to manage members.");
  }
};

const replaceConfigProject = ({
  config,
  nextProject,
}: {
  config: BaseBuddyConfig;
  nextProject: BaseBuddyConfigProject;
}) => ({
  ...config,
  projects: config.projects.map((project) => (project.id === nextProject.id ? nextProject : project)),
});

const projectRolePriorityByKey = new Map(
  DEFAULT_PROJECT_ROLE_DEFINITIONS.map((role) => [role.roleKey, role.priority]),
);

const getHighestRolePriorityValue = (roles: readonly string[]) =>
  Math.max(...normalizeProjectMemberRoles(roles).map((role) => projectRolePriorityByKey.get(role) ?? 0), 0);

const assertInvitationRolesAllowed = ({
  actorMember,
  roles,
}: {
  actorMember: BaseBuddyConfigProjectMember;
  roles: readonly ProjectRole[];
}) => {
  const actorAccess = getConfigProjectMemberAccess(actorMember);

  if (!actorAccess.permissions.includes("member.invite")) {
    throw new Error("Not authorized to invite project members.");
  }

  if (!isProjectOwner(actorMember) && roles.includes("owner")) {
    throw new Error("Not authorized to assign owner memberships.");
  }

  const actorPriority = getHighestRolePriorityValue(actorMember.roles);
  const requestedPriority = getHighestRolePriorityValue(roles);

  if (requestedPriority > actorPriority) {
    throw new Error("Not authorized to invite members with higher access.");
  }
};

const assertAuthorScopesMatchRoles = ({
  authorScopes,
  roles,
}: {
  authorScopes: readonly ProjectMemberAuthorScope[];
  roles: readonly ProjectRole[];
}) => {
  const hasAuthorRole = roles.includes("author");

  if (hasAuthorRole && authorScopes.length === 0) {
    throw new Error("Select at least one author scope for the author role.");
  }

  if (!hasAuthorRole && authorScopes.length > 0) {
    throw new Error("Author scopes can only be assigned when the author role is selected.");
  }
};

const getDefaultInvitationExpiresAt = (now: string) => {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 14);
  return expiresAt.toISOString();
};

const isPendingConfigInvitation = (invitation: BaseBuddyConfigInvitation, now = getCurrentTimestamp()) =>
  getProjectMemberInvitationStatus({
    acceptedAt: invitation.acceptedAt,
    expiresAt: invitation.expiresAt,
    now,
    revokedAt: invitation.revokedAt,
  }) === "pending";

const toProjectMemberInvitationRecord = (
  invitation: BaseBuddyConfigInvitation,
): ProjectMemberInvitationRecord => ({
  acceptedAt: invitation.acceptedAt,
  authorScopes: normalizeConfigAuthorScopes(invitation.authorScopes),
  createdAt: invitation.createdAt,
  expiresAt: invitation.expiresAt,
  invitationId: invitation.id,
  invitePath: buildProjectMemberInvitationPath(invitation.publicToken),
  invitedEmail: invitation.invitedEmail,
  revokedAt: invitation.revokedAt,
  roles: normalizeProjectMemberRoles(invitation.roles),
  status: getProjectMemberInvitationStatus({
    acceptedAt: invitation.acceptedAt,
    expiresAt: invitation.expiresAt,
    revokedAt: invitation.revokedAt,
  }),
});

const compareInvitationsByCreatedAtDescending = (
  left: BaseBuddyConfigInvitation,
  right: BaseBuddyConfigInvitation,
) => {
  const createdDifference = right.createdAt.localeCompare(left.createdAt);
  return createdDifference || right.id.localeCompare(left.id);
};

const hasProjectSlugConflict = ({
  config,
  excludeProjectId,
  slug,
}: {
  config: BaseBuddyConfig;
  excludeProjectId?: string | null;
  slug: string;
}) =>
  config.projects.some((project) => project.slug === slug && project.id !== excludeProjectId);

const createDefaultDraftMappingState = ({
  now,
  projectId,
}: {
  now: string;
  projectId: string;
}) => {
  const revisionId = createConfigId();
  const mappingConfig = createDefaultContentMappingConfig();
  const mapping = normalizeContentProjectMapping({
    bindingId: projectId,
    bindingMode: "mapped_content",
    bindingStatus: "draft",
    mappingConfig,
    revisionId,
    revisionVersion: 1,
  });

  return {
    mapping,
    revision: {
      bindingStatus: "draft" as const,
      createdAt: now,
      id: revisionId,
      mappingConfig: mapping.mappingConfig,
      source: "system" as const,
      version: 1,
    },
  };
};

const createFallbackContentProjectMapping = (projectId: string): ContentProjectMapping =>
  normalizeContentProjectMapping({
    bindingId: projectId,
    bindingMode: "mapped_content",
    bindingStatus: "draft",
    mappingConfig: createDefaultContentMappingConfig(),
    revisionId: null,
    revisionVersion: null,
  });

const getLatestMappingRevision = (project: BaseBuddyConfigProject) =>
  [...project.mappingRevisions].sort((left, right) => left.version - right.version).at(-1) ??
  null;

const normalizeConfigProjectContentMapping = (
  project: BaseBuddyConfigProject,
): ContentProjectMapping => {
  const latestRevision = getLatestMappingRevision(project);
  const mapping = project.mapping
    ? normalizeContentProjectMapping(project.mapping)
    : latestRevision
      ? normalizeContentProjectMapping({
          bindingId: project.id,
          bindingMode: "mapped_content",
          bindingStatus: latestRevision.bindingStatus,
          mappingConfig: latestRevision.mappingConfig,
          revisionId: latestRevision.id,
          revisionVersion: latestRevision.version,
        })
      : createFallbackContentProjectMapping(project.id);

  if (
    mapping.bindingId &&
    (mapping.revisionId || !latestRevision) &&
    (mapping.revisionVersion || !latestRevision)
  ) {
    return mapping;
  }

  return normalizeContentProjectMapping({
    bindingId: mapping.bindingId || project.id,
    bindingMode: mapping.bindingMode,
    bindingStatus: latestRevision?.bindingStatus ?? mapping.bindingStatus,
    mappingConfig: mapping.mappingConfig,
    revisionId: mapping.revisionId ?? latestRevision?.id ?? null,
    revisionVersion: mapping.revisionVersion ?? latestRevision?.version ?? null,
  });
};

export const getConfigProjectMemberAccess = (
  member: Pick<
    BaseBuddyConfigProjectMember,
    "allowPermissionKeys" | "authorScopes" | "denyPermissionKeys" | "roles"
  >,
): ProjectMemberAccess => {
  const roles = normalizeProjectMemberRoles(member.roles);
  const inheritedPermissionKeys = normalizePermissionKeys(
    roles.flatMap((role) => DEFAULT_PROJECT_ROLE_PERMISSION_KEYS[role] ?? []),
  );
  const allowPermissionKeys = normalizePermissionKeys(member.allowPermissionKeys);
  const denyPermissionKeys = normalizePermissionKeys(member.denyPermissionKeys);

  return {
    authorScopes: member.authorScopes
      .map((scope) => ({
        canPublish: normalizeProjectMemberAuthorScopeCanPublish(scope.canPublish),
        cmsAuthorId: scope.cmsAuthorId.trim(),
      }))
      .filter((scope) => scope.cmsAuthorId),
    permissions: getEffectivePermissionKeys({
      allowPermissionKeys,
      denyPermissionKeys,
      inheritedPermissionKeys,
    }),
    roles,
  };
};

export const getConfigProjectPostSidebarConfig = async (
  projectId: string,
): Promise<ContentPostSidebarConfig> => {
  const config = await loadBaseBuddyConfig();
  const project = getConfigProjectById(config, projectId);

  return project.sidebar
    ? normalizeContentPostSidebarConfig(project.sidebar)
    : createDefaultContentPostSidebarConfig();
};

export const saveConfigProjectPostSidebarConfig = async ({
  config: sidebarConfig,
  projectId,
  source = "manual",
}: SaveConfigProjectPostSidebarConfigInput): Promise<ContentPostSidebarConfig> => {
  const normalizedConfig = normalizeContentPostSidebarConfig(sidebarConfig);
  const now = getCurrentTimestamp();
  const revisionId = createConfigId();
  let savedConfig: ContentPostSidebarConfig | null = null;

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const latestRevisionVersion = Math.max(
      0,
      ...project.sidebarRevisions.map((revision) => revision.version),
    );
    const nextProject: BaseBuddyConfigProject = {
      ...project,
      sidebar: normalizedConfig,
      sidebarRevisions: [
        ...project.sidebarRevisions,
        {
          config: normalizedConfig,
          createdAt: now,
          id: revisionId,
          source,
          version: latestRevisionVersion + 1,
        },
      ],
      updatedAt: now,
    };

    savedConfig = normalizedConfig;

    return replaceConfigProject({
      config,
      nextProject,
    });
  });

  if (!savedConfig) {
    throw new ConfigProjectNotFoundError();
  }

  return savedConfig;
};

export const listConfigProjectMembers = async ({
  currentUserId,
  page = 1,
  pageSize = 100,
  projectId,
}: ListConfigProjectMembersInput): Promise<ConfigProjectMembersPayload> => {
  const boundedPage = Math.max(1, Math.floor(page));
  const boundedPageSize = Math.max(1, Math.min(Math.floor(pageSize), 100));
  const offset = (boundedPage - 1) * boundedPageSize;
  const config = await loadBaseBuddyConfig();
  const project = getConfigProjectById(config, projectId);
  const currentMember = getConfigProjectMember({
    project,
    userId: currentUserId,
  });
  const rows = project.members.slice(offset, offset + boundedPageSize + 1);

  return {
    currentRoleKeys: normalizeProjectMemberRoles(currentMember.roles),
    hasMoreMembers: rows.length > boundedPageSize,
    memberAccess: getConfigProjectMemberAccess(currentMember),
    memberPage: boundedPage,
    memberPageSize: boundedPageSize,
    members: rows.slice(0, boundedPageSize).map((member) =>
      toProjectMemberRecord({
        member,
        user: getConfigUserById({
          config,
          userId: member.userId,
        }),
      }),
    ),
  };
};

export const addConfigProjectMemberByEmail = async ({
  actorUserId,
  authorScopes,
  email,
  projectId,
  roles,
}: AddConfigProjectMemberInput) => {
  const normalizedRoles = normalizeConfigProjectRoles(roles);
  const normalizedAuthorScopes = normalizeConfigAuthorScopes(authorScopes);
  const now = getCurrentTimestamp();
  let addedUserId: string | null = null;

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const actorMember = getConfigProjectMember({
      project,
      userId: actorUserId,
    });

    assertMemberHasPermission({
      member: actorMember,
      message: "Not authorized to invite project members.",
      permissionKey: "member.invite",
    });

    if (!isProjectOwner(actorMember) && normalizedRoles.includes("owner")) {
      throw new Error("Not authorized to assign owner memberships.");
    }

    const user = getConfigUserByEmail({
      config,
      email,
    });

    if (!user) {
      throw new Error("That user needs to sign in before you can add them.");
    }

    if (project.members.some((member) => member.userId === user.id)) {
      throw new Error("That user is already a member of this project.");
    }

    addedUserId = user.id;
    const nextProject: BaseBuddyConfigProject = {
      ...project,
      members: [
        ...project.members,
        {
          allowPermissionKeys: [],
          authorScopes: normalizedAuthorScopes,
          denyPermissionKeys: [],
          joinedAt: now,
          roles: normalizedRoles,
          userId: user.id,
        },
      ],
      updatedAt: now,
    };

    return replaceConfigProject({
      config,
      nextProject,
    });
  });

  if (!addedUserId) {
    throw new Error("Could not add that member right now.");
  }

  return { userId: addedUserId };
};

export const updateConfigProjectMemberAccess = async ({
  actorUserId,
  authorScopes,
  projectId,
  roles,
  userId,
}: MutateConfigProjectMemberInput) => {
  const normalizedRoles = normalizeConfigProjectRoles(roles);
  const normalizedAuthorScopes = normalizeConfigAuthorScopes(authorScopes);
  const now = getCurrentTimestamp();

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const actorMember = getConfigProjectMember({
      project,
      userId: actorUserId,
    });
    const targetMember = getConfigProjectMember({
      project,
      userId,
    });

    assertMemberHasPermission({
      member: actorMember,
      message: "Not authorized to manage project members.",
      permissionKey: "member.manage",
    });
    assertOwnerRoleMutationAllowed({
      actorMember,
      nextRoles: normalizedRoles,
      project,
      targetMember,
    });

    const nextProject: BaseBuddyConfigProject = {
      ...project,
      members: project.members.map((member) =>
        member.userId === userId
          ? {
              ...member,
              authorScopes: normalizedAuthorScopes,
              roles: normalizedRoles,
            }
          : member,
      ),
      updatedAt: now,
    };

    assertAtLeastOneMemberCanManageMembers(nextProject);

    return replaceConfigProject({
      config,
      nextProject,
    });
  });
};

export const removeConfigProjectMember = async ({
  actorUserId,
  projectId,
  userId,
}: RemoveConfigProjectMemberInput) => {
  const now = getCurrentTimestamp();

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const actorMember = getConfigProjectMember({
      project,
      userId: actorUserId,
    });
    const targetMember = getConfigProjectMember({
      project,
      userId,
    });

    assertMemberHasPermission({
      member: actorMember,
      message: "Not authorized to manage project members.",
      permissionKey: "member.manage",
    });
    assertOwnerRemovalAllowed({
      actorMember,
      project,
      targetMember,
    });

    const nextProject: BaseBuddyConfigProject = {
      ...project,
      members: project.members.filter((member) => member.userId !== userId),
      updatedAt: now,
    };

    assertAtLeastOneMemberCanManageMembers(nextProject);

    return replaceConfigProject({
      config,
      nextProject,
    });
  });
};

export const listConfigProjectPermissionMembers = async ({
  currentUserId,
  projectId,
}: {
  currentUserId: string;
  projectId: string;
}): Promise<ConfigProjectPermissionsPayload> => {
  const config = await loadBaseBuddyConfig();
  const project = getConfigProjectById(config, projectId);
  getConfigProjectMember({
    project,
    userId: currentUserId,
  });

  return {
    currentUserId,
    members: project.members.map((member) =>
      toProjectPermissionMemberRecord({
        member,
        user: getConfigUserById({
          config,
          userId: member.userId,
        }),
      }),
    ),
    permissions: getSortedProjectPermissionDefinitions(),
  };
};

export const setConfigProjectMemberPermissionOverrides = async ({
  actorUserId,
  allowPermissionKeys,
  denyPermissionKeys,
  projectId,
  userId,
}: SetConfigProjectMemberPermissionOverridesInput) => {
  const normalizedAllowPermissionKeys = normalizeConfigPermissionOverrides(allowPermissionKeys);
  const normalizedDenyPermissionKeys = normalizeConfigPermissionOverrides(denyPermissionKeys);
  const now = getCurrentTimestamp();

  for (const permissionKey of normalizedAllowPermissionKeys) {
    if (normalizedDenyPermissionKeys.includes(permissionKey)) {
      throw new Error("A permission cannot be both allowed and denied.");
    }
  }

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const actorMember = getConfigProjectMember({
      project,
      userId: actorUserId,
    });
    const targetMember = getConfigProjectMember({
      project,
      userId,
    });
    const actorAccess = getConfigProjectMemberAccess(actorMember);
    const actorIsOwner = isProjectOwner(actorMember);
    const hasDeleteOverride =
      normalizedAllowPermissionKeys.includes("project.delete") ||
      normalizedDenyPermissionKeys.includes("project.delete");

    if (
      !(actorAccess.permissions.includes("member.manage") && (actorAccess.roles.includes("owner") || actorAccess.roles.includes("admin")))
    ) {
      throw new Error("You do not have permission to manage member permissions.");
    }

    if (!actorIsOwner && isProjectOwner(targetMember)) {
      throw new Error("You do not have permission to change owner permissions.");
    }

    if (!actorIsOwner && hasDeleteOverride) {
      throw new Error("You do not have permission to grant or remove project delete permission.");
    }

    const nextProject: BaseBuddyConfigProject = {
      ...project,
      members: project.members.map((member) =>
        member.userId === userId
          ? {
              ...member,
              allowPermissionKeys: normalizedAllowPermissionKeys,
              denyPermissionKeys: normalizedDenyPermissionKeys,
            }
          : member,
      ),
      updatedAt: now,
    };

    assertAtLeastOneMemberCanManageMembers(nextProject);

    return replaceConfigProject({
      config,
      nextProject,
    });
  });
};

export const getConfigProjectAuthorMembers = async ({
  projectId,
}: {
  projectId: string;
}): Promise<ProjectAuthorMember[]> => {
  const config = await loadBaseBuddyConfig();
  const project = getConfigProjectById(config, projectId);

  return project.members
    .filter((member) => normalizeProjectMemberRoles(member.roles).includes("author"))
    .map((member) => {
      const user = getConfigUserById({
        config,
        userId: member.userId,
      });

      return {
        avatarUrl: user?.avatarUrl ?? null,
        email: user?.email ?? null,
        name: user?.name ?? null,
        userId: member.userId,
      };
    });
};

export const getConfigProjectAuthorAssignments = async ({
  projectId,
}: {
  projectId: string;
}): Promise<ProjectAuthorAssignment[]> => {
  const config = await loadBaseBuddyConfig();
  const project = getConfigProjectById(config, projectId);

  return project.members.flatMap((member) =>
    normalizeConfigAuthorScopes(member.authorScopes).map((scope) => ({
      canPublish: normalizeProjectMemberAuthorScopeCanPublish(scope.canPublish),
      cmsAuthorId: scope.cmsAuthorId,
      userId: member.userId,
    })),
  );
};

export const getConfigProjectPostAuthorAssignments = async (
  projectId: string,
): Promise<Map<string, ConfigProjectPostAuthorAssignment>> => {
  const config = await loadBaseBuddyConfig();
  const project = getConfigProjectById(config, projectId);
  const assignments = project.members.flatMap((member) => {
    const user = getConfigUserById({
      config,
      userId: member.userId,
    });

    return normalizeConfigAuthorScopes(member.authorScopes).map((scope) => ({
      avatar_url: user?.avatarUrl ?? null,
      cms_author_id: scope.cmsAuthorId,
      email: user?.email ?? null,
      name: user?.name ?? null,
      user_id: member.userId,
    }));
  });

  return new Map(assignments.map((assignment) => [assignment.cms_author_id, assignment]));
};

export const setConfigProjectAuthorAssignment = async ({
  actorUserId,
  canPublish = true,
  cmsAuthorId,
  projectId,
  userId,
}: SetConfigProjectAuthorAssignmentInput) => {
  const normalizedCmsAuthorId = cmsAuthorId.trim();
  const now = getCurrentTimestamp();

  if (!normalizedCmsAuthorId) {
    throw new Error("Select a content author first.");
  }

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const actorMember = getConfigProjectMember({
      project,
      userId: actorUserId,
    });

    assertMemberHasPermission({
      member: actorMember,
      message: "You do not have permission to manage author assignments.",
      permissionKey: "author.scope.manage",
    });

    const targetMember = userId
      ? getConfigProjectMember({
          project,
          userId,
        })
      : null;

    if (targetMember && !normalizeProjectMemberRoles(targetMember.roles).includes("author")) {
      throw new Error("Select a project member with the author role.");
    }

    const nextProject: BaseBuddyConfigProject = {
      ...project,
      members: project.members.map((member) => {
        const remainingScopes = normalizeConfigAuthorScopes(member.authorScopes).filter(
          (scope) => scope.cmsAuthorId !== normalizedCmsAuthorId,
        );

        if (!targetMember || member.userId !== targetMember.userId) {
          return {
            ...member,
            authorScopes: remainingScopes,
          };
        }

        return {
          ...member,
          authorScopes: [
            ...remainingScopes,
            {
              canPublish: normalizeProjectMemberAuthorScopeCanPublish(canPublish),
              cmsAuthorId: normalizedCmsAuthorId,
            },
          ],
        };
      }),
      updatedAt: now,
    };

    return replaceConfigProject({
      config,
      nextProject,
    });
  });
};

export const removeConfigProjectAuthorScopes = async ({
  cmsAuthorIds,
  projectId,
}: {
  cmsAuthorIds: readonly string[];
  projectId: string;
}) => {
  const authorIds = new Set(cmsAuthorIds.map((authorId) => authorId.trim()).filter(Boolean));

  if (!authorIds.size) {
    return;
  }

  const now = getCurrentTimestamp();

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const nextProject: BaseBuddyConfigProject = {
      ...project,
      members: project.members.map((member) => ({
        ...member,
        authorScopes: normalizeConfigAuthorScopes(member.authorScopes).filter(
          (scope) => !authorIds.has(scope.cmsAuthorId),
        ),
      })),
      updatedAt: now,
    };

    return replaceConfigProject({
      config,
      nextProject,
    });
  });
};

export const listConfigProjectMemberInvitations = async ({
  actorUserId,
  page = 1,
  pageSize = 100,
  projectId,
}: ListConfigProjectMemberInvitationsInput): Promise<ProjectMemberInvitationsPayload> => {
  const boundedPage = Math.max(1, Math.floor(page));
  const boundedPageSize = Math.max(1, Math.min(Math.floor(pageSize), 100));
  const offset = (boundedPage - 1) * boundedPageSize;
  const config = await loadBaseBuddyConfig();
  const project = getConfigProjectById(config, projectId);
  const actorMember = getConfigProjectMember({
    project,
    userId: actorUserId,
  });

  assertMemberHasPermission({
    member: actorMember,
    message: "Not authorized to read project invitations.",
    permissionKey: "member.invite",
  });

  const projectInvitations = config.invitations
    .filter((invitation) => invitation.projectId === projectId)
    .sort(compareInvitationsByCreatedAtDescending);
  const invitationRows = projectInvitations.slice(offset, offset + boundedPageSize + 1);

  return {
    hasMoreInvitations: invitationRows.length > boundedPageSize,
    invitationPage: boundedPage,
    invitationPageSize: boundedPageSize,
    invitations: invitationRows.slice(0, boundedPageSize).map(toProjectMemberInvitationRecord),
  };
};

export const createConfigProjectMemberInvitation = async ({
  actorUserId,
  authorScopes,
  email,
  expiresAt,
  projectId,
  publicToken,
  roles,
}: CreateConfigProjectMemberInvitationInput): Promise<{ invitationId: string }> => {
  const normalizedRoles = normalizeConfigProjectRoles(roles);
  const normalizedAuthorScopes = normalizeConfigAuthorScopes(authorScopes);
  const normalizedEmail = normalizeProjectMemberInvitationEmail(email);
  const normalizedPublicToken = publicToken.trim();
  const now = getCurrentTimestamp();
  const normalizedExpiresAt = expiresAt?.trim() || getDefaultInvitationExpiresAt(now);
  const invitationId = createConfigId();

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  if (!normalizedPublicToken) {
    throw new Error("Invitation token is required.");
  }

  if (Date.parse(normalizedExpiresAt) <= Date.parse(now)) {
    throw new Error("Invitation expiry must be in the future.");
  }

  assertAuthorScopesMatchRoles({
    authorScopes: normalizedAuthorScopes,
    roles: normalizedRoles,
  });

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const actorMember = getConfigProjectMember({
      project,
      userId: actorUserId,
    });

    assertInvitationRolesAllowed({
      actorMember,
      roles: normalizedRoles,
    });

    if (config.invitations.some((invitation) => invitation.publicToken === normalizedPublicToken)) {
      throw new Error("That invitation token is already in use.");
    }

    const existingMember = project.members.find((member) => {
      const user = getConfigUserById({
        config,
        userId: member.userId,
      });

      return normalizeProjectMemberInvitationEmail(user?.email) === normalizedEmail;
    });

    if (existingMember) {
      throw new Error("That person is already a member of this project.");
    }

    const hasPendingInvitation = config.invitations.some((invitation) =>
      invitation.projectId === projectId &&
      normalizeProjectMemberInvitationEmail(invitation.invitedEmail) === normalizedEmail &&
      isPendingConfigInvitation(invitation, now),
    );

    if (hasPendingInvitation) {
      throw new Error("That email already has a pending invitation.");
    }

    return {
      ...config,
      invitations: [
        ...config.invitations,
        {
          acceptedAt: null,
          acceptedBy: null,
          authorScopes: normalizedAuthorScopes,
          createdAt: now,
          createdBy: actorUserId,
          expiresAt: normalizedExpiresAt,
          id: invitationId,
          invitedEmail: email.trim(),
          projectId,
          publicToken: normalizedPublicToken,
          revokedAt: null,
          revokedBy: null,
          roles: normalizedRoles,
        },
      ],
    };
  });

  return { invitationId };
};

export const revokeConfigProjectMemberInvitation = async ({
  actorUserId,
  invitationId,
  projectId,
}: RevokeConfigProjectMemberInvitationInput) => {
  const now = getCurrentTimestamp();

  await writeBaseBuddyConfig((config) => {
    const project = getConfigProjectById(config, projectId);
    const actorMember = getConfigProjectMember({
      project,
      userId: actorUserId,
    });

    assertMemberHasPermission({
      member: actorMember,
      message: "Not authorized to manage project invitations.",
      permissionKey: "member.invite",
    });

    const invitation = config.invitations.find(
      (candidate) => candidate.projectId === projectId && candidate.id === invitationId,
    );

    if (!invitation) {
      throw new Error("Project invitation not found.");
    }

    const status = getProjectMemberInvitationStatus({
      acceptedAt: invitation.acceptedAt,
      expiresAt: invitation.expiresAt,
      now,
      revokedAt: invitation.revokedAt,
    });

    if (status === "accepted") {
      throw new Error("This invitation has already been accepted.");
    }

    if (status === "revoked") {
      throw new Error("This invitation has already been revoked.");
    }

    if (status === "expired") {
      throw new Error("This invitation has already expired.");
    }

    return {
      ...config,
      invitations: config.invitations.map((candidate) =>
        candidate.id === invitationId && candidate.projectId === projectId
          ? {
              ...candidate,
              revokedAt: now,
              revokedBy: actorUserId,
            }
          : candidate,
      ),
    };
  });
};

export const getConfigProjectMemberInvitationPreview = async (
  publicToken: string,
): Promise<ProjectMemberInvitationPreview | null> => {
  const normalizedToken = publicToken.trim();

  if (!normalizedToken) {
    return null;
  }

  const config = await loadBaseBuddyConfig();
  const invitation = config.invitations.find((candidate) => candidate.publicToken === normalizedToken) ?? null;

  if (!invitation) {
    return null;
  }

  const project = config.projects.find((candidate) => candidate.id === invitation.projectId) ?? null;

  if (!project) {
    return null;
  }

  const invitationRecord = toProjectMemberInvitationRecord(invitation);

  return {
    acceptedAt: invitationRecord.acceptedAt,
    authorScopes: invitationRecord.authorScopes,
    expiresAt: invitationRecord.expiresAt,
    invitePath: invitationRecord.invitePath,
    invitedEmail: invitationRecord.invitedEmail,
    projectId: project.id,
    projectName: project.name,
    projectSlug: project.slug,
    revokedAt: invitationRecord.revokedAt,
    roles: invitationRecord.roles,
    status: invitationRecord.status,
  };
};

export const acceptConfigProjectMemberInvitation = async ({
  publicToken,
  userEmail,
  userId,
}: AcceptConfigProjectMemberInvitationInput): Promise<AcceptProjectMemberInvitationResult & { projectId: string }> => {
  const normalizedToken = publicToken.trim();
  const normalizedUserEmail = normalizeProjectMemberInvitationEmail(userEmail);
  const now = getCurrentTimestamp();
  let result: (AcceptProjectMemberInvitationResult & { projectId: string }) | null = null;

  if (!normalizedToken) {
    throw new Error("Project invitation not found.");
  }

  await writeBaseBuddyConfig((config) => {
    const invitation = config.invitations.find((candidate) => candidate.publicToken === normalizedToken) ?? null;

    if (!invitation) {
      throw new Error("Project invitation not found.");
    }

    const project = getConfigProjectById(config, invitation.projectId);
    const status = getProjectMemberInvitationStatus({
      acceptedAt: invitation.acceptedAt,
      expiresAt: invitation.expiresAt,
      now,
      revokedAt: invitation.revokedAt,
    });

    if (status === "accepted") {
      if (invitation.acceptedBy === userId) {
        result = {
          redirectTo: `/projects/${project.slug}`,
          projectId: project.id,
          status: "already_member",
        };
        return config;
      }

      throw new Error("This invitation has already been accepted.");
    }

    if (status === "revoked") {
      throw new Error("This invitation has been revoked.");
    }

    if (status === "expired") {
      throw new Error("This invitation has expired.");
    }

    if (!normalizedUserEmail) {
      throw new Error("Sign in with the invited email address first.");
    }

    if (normalizedUserEmail !== normalizeProjectMemberInvitationEmail(invitation.invitedEmail)) {
      throw new Error("Sign in with the invited email address to accept this invitation.");
    }

    const existingMember = project.members.find((member) => member.userId === userId) ?? null;
    const acceptedInvitation = {
      ...invitation,
      acceptedAt: now,
      acceptedBy: userId,
    };

    if (existingMember) {
      result = {
        redirectTo: `/projects/${project.slug}`,
        projectId: project.id,
        status: "already_member",
      };

      return {
        ...config,
        invitations: config.invitations.map((candidate) =>
          candidate.id === invitation.id ? acceptedInvitation : candidate,
        ),
      };
    }

    assertAuthorScopesMatchRoles({
      authorScopes: normalizeConfigAuthorScopes(invitation.authorScopes),
      roles: normalizeConfigProjectRoles(invitation.roles),
    });

    const nextProject: BaseBuddyConfigProject = {
      ...project,
      members: [
        ...project.members,
        {
          allowPermissionKeys: [],
          authorScopes: normalizeConfigAuthorScopes(invitation.authorScopes),
          denyPermissionKeys: [],
          joinedAt: now,
          roles: normalizeConfigProjectRoles(invitation.roles),
          userId,
        },
      ],
      updatedAt: now,
    };

    result = {
      redirectTo: `/projects/${project.slug}`,
      projectId: project.id,
      status: "accepted",
    };

    return {
      ...config,
      invitations: config.invitations.map((candidate) =>
        candidate.id === invitation.id ? acceptedInvitation : candidate,
      ),
      projects: config.projects.map((candidate) => (candidate.id === project.id ? nextProject : candidate)),
    };
  });

  if (!result) {
    throw new Error("Could not accept this invitation right now.");
  }

  return result;
};

const toConfigProjectSummary = ({
  member,
  project,
}: {
  member: BaseBuddyConfigProjectMember;
  project: BaseBuddyConfigProject;
}): ConfigProjectSummary | null => {
  const role = getHighestProjectRole(member.roles);

  if (!role) {
    return null;
  }

  return {
    createdAt: project.createdAt,
    id: project.id,
    name: project.name,
    role,
    slug: project.slug,
    websiteUrl: project.websiteUrl,
  };
};

const compareProjectsByCreatedAtDescending = (
  left: ConfigProjectSummary,
  right: ConfigProjectSummary,
) => right.createdAt.localeCompare(left.createdAt);

const getConfigProjectSummaryForUserFromProject = ({
  project,
  userId,
}: {
  project: BaseBuddyConfigProject;
  userId: string;
}) => {
  if (project.status !== "active") {
    return null;
  }

  const member = project.members.find((candidate) => candidate.userId === userId) ?? null;

  if (!member) {
    return null;
  }

  return toConfigProjectSummary({
    member,
    project,
  });
};

export const isConfigProjectSlugAvailable = async (
  slug: string,
  options: {
    excludeProjectId?: string | null;
  } = {},
) => {
  const normalizedSlug = normalizeProjectSlug(slug);

  if (!normalizedSlug) {
    return false;
  }

  const config = await loadBaseBuddyConfig();

  return !hasProjectSlugConflict({
    config,
    excludeProjectId: options.excludeProjectId,
    slug: normalizedSlug,
  });
};

export const createConfigProject = async ({
  name,
  slug,
  userId,
}: CreateConfigProjectInput): Promise<ConfigProjectSummary> => {
  const projectName = name.trim();
  const projectSlug = normalizeProjectSlug(slug);

  if (!projectName) {
    throw new Error("Enter a project name first.");
  }

  if (!projectSlug) {
    throw new Error("Enter a unique project address first.");
  }

  const now = getCurrentTimestamp();
  const projectId = createConfigId();
  const { mapping, revision } = createDefaultDraftMappingState({
    now,
    projectId,
  });
  let createdProject: BaseBuddyConfigProject | null = null;

  await writeBaseBuddyConfig((config) => {
    if (
      hasProjectSlugConflict({
        config,
        slug: projectSlug,
      })
    ) {
      throw new ConfigProjectSlugConflictError(
        "That project address is already taken. Choose another address and try again.",
      );
    }

    createdProject = {
      createdAt: now,
      createdBy: userId,
      id: projectId,
      mapping,
      mappingRevisions: [revision],
      members: [
        {
          allowPermissionKeys: [],
          authorScopes: [],
          denyPermissionKeys: [],
          joinedAt: now,
          roles: ["owner"],
          userId,
        },
      ],
      name: projectName,
      sidebar: null,
      sidebarRevisions: [],
      slug: projectSlug,
      status: "active",
      updatedAt: now,
      websiteUrl: null,
    };

    return {
      ...config,
      projects: [...config.projects, createdProject],
    };
  });

  if (!createdProject) {
    throw new Error("Could not create the project right now.");
  }

  return {
    createdAt: createdProject.createdAt,
    id: createdProject.id,
    name: createdProject.name,
    role: "owner",
    slug: createdProject.slug,
    websiteUrl: createdProject.websiteUrl,
  };
};

export const listConfigProjectsForUser = async ({
  limit,
  search,
  userId,
}: {
  limit?: number;
  search?: string | null;
  userId: string;
}): Promise<ConfigProjectListResult> => {
  const projectLimit = normalizeProjectListLimit(limit);
  const projectSearchQuery = normalizeProjectListSearchQuery(search);
  const normalizedSearch = projectSearchQuery.toLowerCase();
  const config = await loadBaseBuddyConfig();
  const projects = config.projects
    .map((project) =>
      getConfigProjectSummaryForUserFromProject({
        project,
        userId,
      }),
    )
    .filter((project): project is ConfigProjectSummary => Boolean(project))
    .filter((project) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        project.name.toLowerCase().includes(normalizedSearch) ||
        project.slug.toLowerCase().includes(normalizedSearch)
      );
    })
    .sort(compareProjectsByCreatedAtDescending);
  const visibleProjects = projects.slice(0, projectLimit);

  return {
    hasMoreProjects: projects.length > visibleProjects.length,
    projectSearchQuery,
    projects: visibleProjects,
    setupRequired: false,
  };
};

export const getConfigProjectForUser = async ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<ConfigProjectResult> => {
  const config = await loadBaseBuddyConfig();
  const project = config.projects.find((candidate) => candidate.id === projectId) ?? null;

  return {
    project: project
      ? getConfigProjectSummaryForUserFromProject({
          project,
          userId,
        })
      : null,
    setupRequired: false,
  };
};

export const getConfigProjectForUserBySlug = async ({
  projectSlug,
  userId,
}: {
  projectSlug: string;
  userId: string;
}): Promise<ConfigProjectResult> => {
  const normalizedSlug = normalizeProjectSlug(projectSlug);

  if (!normalizedSlug) {
    return {
      project: null,
      setupRequired: false,
    };
  }

  const config = await loadBaseBuddyConfig();
  const project = config.projects.find((candidate) => candidate.slug === normalizedSlug) ?? null;

  return {
    project: project
      ? getConfigProjectSummaryForUserFromProject({
          project,
          userId,
        })
      : null,
    setupRequired: false,
  };
};

export const updateConfigProjectMetadata = async ({
  name,
  projectId,
  slug,
  websiteUrl,
}: UpdateConfigProjectMetadataInput): Promise<ConfigProjectSummary> => {
  const projectName = name.trim();
  const projectSlug = normalizeProjectSlug(slug);
  const now = getCurrentTimestamp();
  let updatedProject: BaseBuddyConfigProject | null = null;

  if (!projectName) {
    throw new Error("Enter a project name first.");
  }

  if (!projectSlug) {
    throw new Error("Enter a project address first.");
  }

  await writeBaseBuddyConfig((config) => {
    if (
      hasProjectSlugConflict({
        config,
        excludeProjectId: projectId,
        slug: projectSlug,
      })
    ) {
      throw new ConfigProjectSlugConflictError();
    }

    let foundProject = false;
    const projects = config.projects.map((project) => {
      if (project.id !== projectId) {
        return project;
      }

      foundProject = true;
      updatedProject = {
        ...project,
        name: projectName,
        slug: projectSlug,
        updatedAt: now,
        websiteUrl,
      };
      return updatedProject;
    });

    if (!foundProject) {
      throw new ConfigProjectNotFoundError();
    }

    return {
      ...config,
      projects,
    };
  });

  if (!updatedProject) {
    throw new ConfigProjectNotFoundError();
  }

  const member = updatedProject.members[0] ?? {
    allowPermissionKeys: [],
    authorScopes: [],
    denyPermissionKeys: [],
    joinedAt: updatedProject.createdAt,
    roles: ["viewer" as ProjectRole],
    userId: updatedProject.createdBy,
  };
  const projectSummary = toConfigProjectSummary({
    member,
    project: updatedProject,
  });

  if (!projectSummary) {
    throw new ConfigProjectNotFoundError();
  }

  return projectSummary;
};

export const deleteConfigProject = async ({
  projectId,
}: {
  projectId: string;
}): Promise<{ deletedProject: BaseBuddyConfigProject }> => {
  let deletedProject: BaseBuddyConfigProject | null = null;

  await writeBaseBuddyConfig((config) => {
    const projects = config.projects.filter((project) => {
      if (project.id !== projectId) {
        return true;
      }

      deletedProject = project;
      return false;
    });

    if (!deletedProject) {
      throw new ConfigProjectNotFoundError();
    }

    return {
      ...config,
      invitations: config.invitations.filter((invitation) => invitation.projectId !== projectId),
      projects,
    };
  });

  if (!deletedProject) {
    throw new ConfigProjectNotFoundError();
  }

  return { deletedProject };
};

export const getConfigProjectContentMapping = async ({
  projectId,
}: {
  projectId: string;
}): Promise<ContentProjectMapping> => {
  const config = await loadBaseBuddyConfig();
  const project = config.projects.find((candidate) => candidate.id === projectId) ?? null;

  if (!project) {
    throw new ConfigProjectNotFoundError();
  }

  return normalizeConfigProjectContentMapping(project);
};

export const saveConfigProjectContentMappingRevision = async ({
  bindingStatus,
  mappingConfig,
  projectId,
  source = "manual",
}: SaveConfigProjectContentMappingRevisionInput): Promise<ContentProjectMapping> => {
  const normalizedMappingConfig = normalizeContentMappingConfig(mappingConfig);
  const now = getCurrentTimestamp();
  const revisionId = createConfigId();
  let savedMapping: ContentProjectMapping | null = null;

  await writeBaseBuddyConfig((config) => {
    let foundProject = false;
    const projects = config.projects.map((project) => {
      if (project.id !== projectId) {
        return project;
      }

      foundProject = true;
      const currentMapping = normalizeConfigProjectContentMapping(project);
      const latestRevision = getLatestMappingRevision(project);
      const revisionVersion =
        Math.max(
          currentMapping.revisionVersion ?? 0,
          latestRevision?.version ?? 0,
        ) + 1;
      savedMapping = normalizeContentProjectMapping({
        bindingId: currentMapping.bindingId || projectId,
        bindingMode: "mapped_content",
        bindingStatus: bindingStatus ?? currentMapping.bindingStatus,
        mappingConfig: normalizedMappingConfig,
        revisionId,
        revisionVersion,
      });

      return {
        ...project,
        mapping: savedMapping,
        mappingRevisions: [
          ...project.mappingRevisions,
          {
            bindingStatus: savedMapping.bindingStatus,
            createdAt: now,
            id: revisionId,
            mappingConfig: savedMapping.mappingConfig,
            source,
            version: revisionVersion,
          },
        ],
        updatedAt: now,
      };
    });

    if (!foundProject) {
      throw new ConfigProjectNotFoundError();
    }

    return {
      ...config,
      projects,
    };
  });

  if (!savedMapping) {
    throw new ConfigProjectNotFoundError();
  }

  return savedMapping;
};

export const getConfigProjectAccessContextFromProject = ({
  project,
  userId,
}: {
  project: BaseBuddyConfigProject | null | undefined;
  userId: string;
}): ConfigProjectAccessContext | null => {
  if (!project || project.status !== "active") {
    return null;
  }

  const member = project.members.find((candidate) => candidate.userId === userId) ?? null;

  if (!member) {
    return null;
  }

  const projectSummary = toConfigProjectSummary({
    member,
    project,
  });

  if (!projectSummary) {
    return null;
  }

  return {
    memberAccess: getConfigProjectMemberAccess(member),
    project: projectSummary,
  };
};

export const getConfigProjectAccessContext = async ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) => {
  const config = await loadBaseBuddyConfig();

  return getConfigProjectAccessContextFromProject({
    project: config.projects.find((project) => project.id === projectId) ?? null,
    userId,
  });
};

export const getConfigProjectAccessContextBySlug = async ({
  projectSlug,
  userId,
}: {
  projectSlug: string;
  userId: string;
}) => {
  const config = await loadBaseBuddyConfig();
  const normalizedSlug = normalizeProjectSlug(projectSlug);

  if (!normalizedSlug) {
    return null;
  }

  return getConfigProjectAccessContextFromProject({
    project: config.projects.find((project) => project.slug === normalizedSlug) ?? null,
    userId,
  });
};
