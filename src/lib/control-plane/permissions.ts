import type { ProjectMemberAuthorScope } from "./members";

export type ProjectPermissionKey =
  | "author.scope.manage"
  | "content.publish.all"
  | "content.publish.authored"
  | "content.read.all"
  | "content.read.authored"
  | "content.write.all"
  | "content.write.authored"
  | "mapping.read"
  | "mapping.write"
  | "member.manage"
  | "member.read"
  | "project.delete"
  | "project.read"
  | "project.update";

export type ProjectMemberAccess = {
  authorScopes: ProjectMemberAuthorScope[];
  permissions: string[];
  roles: string[];
};

export type ProjectContentAction = "publish" | "read" | "write";

const getProjectContentPermissionKeys = (action: ProjectContentAction) => {
  if (action === "read") {
    return {
      all: "content.read.all" as const,
      authored: "content.read.authored" as const,
    };
  }

  if (action === "write") {
    return {
      all: "content.write.all" as const,
      authored: "content.write.authored" as const,
    };
  }

  return {
    all: "content.publish.all" as const,
    authored: "content.publish.authored" as const,
  };
};

export const hasProjectPermission = (
  access: ProjectMemberAccess,
  permissionKey: ProjectPermissionKey,
) => access.permissions.includes(permissionKey);

export const hasProjectContentPermission = (
  access: ProjectMemberAccess,
  action: ProjectContentAction,
) => {
  const permissionKeys = getProjectContentPermissionKeys(action);
  return (
    hasProjectPermission(access, permissionKeys.all) ||
    hasProjectPermission(access, permissionKeys.authored)
  );
};

export const canManageProjectTaxonomy = (access: ProjectMemberAccess) =>
  hasProjectPermission(access, "content.write.all");

export const canForceProjectPostTakeover = (access: ProjectMemberAccess) =>
  access.roles.some((role) => role === "owner" || role === "admin" || role === "editor");

export const getAccessibleAuthorIdsForAction = (
  access: ProjectMemberAccess,
  action: ProjectContentAction,
): string[] | null => {
  const permissionKeys = getProjectContentPermissionKeys(action);

  if (hasProjectPermission(access, permissionKeys.all)) {
    return null;
  }

  if (!hasProjectPermission(access, permissionKeys.authored)) {
    return [];
  }

  return access.authorScopes
    .filter((scope) => action !== "publish" || scope.canPublish !== false)
    .map((scope) => scope.cmsAuthorId);
};

export const canAccessAuthorScopedContent = (
  access: ProjectMemberAccess,
  action: ProjectContentAction,
  authorId: string | null | undefined,
) => {
  const accessibleAuthorIds = getAccessibleAuthorIdsForAction(access, action);

  if (accessibleAuthorIds === null) {
    return true;
  }

  if (!authorId) {
    return false;
  }

  return accessibleAuthorIds.includes(authorId);
};
