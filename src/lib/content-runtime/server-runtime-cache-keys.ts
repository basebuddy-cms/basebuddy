import "server-only";

import { getContentMappingRevisionCacheKey } from "./mapped-content-runtime-support";
import type { ContentProjectMapping } from "./mapping";
import type { ContentProjectContext } from "./server-posts-shared";
import type { ContentPostsSort, ContentPostsStatusFilter } from "./shared";

type ContentAccessScopeCacheContext = {
  memberAccess: {
    authorScopes: Array<{ canPublish?: boolean; cmsAuthorId: string }>;
    permissions: string[];
  };
  projectSlug: string;
};

export const getContentAccessScopeCacheSignature = (
  context: ContentAccessScopeCacheContext,
) =>
  [
    context.projectSlug,
    [...context.memberAccess.permissions].sort().join(",") || "no-permissions",
    context.memberAccess.authorScopes
      .map((scope) => `${scope.cmsAuthorId}:${scope.canPublish === false ? "no-publish" : "publish"}`)
      .sort((left, right) => left.localeCompare(right))
      .join(",") || "all-authors",
  ].join(":");

export const getContentContextCacheSignature = (context: ContentProjectContext) =>
  [
    context.user.id,
    getContentAccessScopeCacheSignature(context),
  ].join(":");

export const getContentProjectAccessCacheKey = ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) => ["project-access", projectId, userId].join(":");

export const getContentProjectContextCacheKey = ({
  accessSignature,
  projectId,
  userId,
}: {
  accessSignature: string;
  projectId: string;
  userId: string;
}) => ["project-context", projectId, userId, accessSignature].join(":");

export const getContentProjectCredentialsCacheKey = (projectId: string) =>
  ["project-credentials", projectId].join(":");

export const getContentWorkspaceMetaCacheKey = ({
  context,
  projectId,
}: {
  context: ContentProjectContext;
  projectId: string;
}) => ["workspace", projectId, getContentContextCacheSignature(context)].join(":");

export const getContentWorkspaceSummaryCacheKey = ({
  context,
  projectId,
}: {
  context: ContentProjectContext;
  projectId: string;
}) => ["workspace-summary", projectId, getContentContextCacheSignature(context)].join(":");

export const getContentStorageLibraryCacheKey = ({
  context,
  currentPath,
  cursor,
  includeFolderOptions,
  kind,
  projectId,
  search,
}: {
  context: ContentProjectContext;
  currentPath?: string | null;
  cursor?: string | null;
  includeFolderOptions: boolean;
  kind: "files" | "media";
  projectId: string;
  search?: string | null;
}) =>
  [
    `${kind}-library`,
    projectId,
    getContentContextCacheSignature(context),
    `path:${currentPath?.trim() || "__root__"}`,
    `cursor:${cursor?.trim() || "__first__"}`,
    `search:${search?.trim().toLowerCase() || "__all__"}`,
    `folders:${includeFolderOptions ? "yes" : "no"}`,
  ].join(":");

export const getContentPostsPageCacheKey = ({
  context,
  cursor,
  page,
  pageSize,
  projectId,
  search,
  sort,
  status,
}: {
  context: ContentProjectContext;
  cursor?: string | null;
  page?: number;
  pageSize?: number;
  projectId: string;
  search?: string;
  sort?: ContentPostsSort;
  status?: ContentPostsStatusFilter;
}) =>
  [
    "posts",
    projectId,
    getContentContextCacheSignature(context),
    page ?? 1,
    pageSize ?? "default",
    sort ?? "updated_desc",
    status ?? "all",
    search?.trim() || "__all__",
    cursor?.trim() || "__offset__",
  ].join(":");

export const getContentPostsPresenceCacheKey = ({
  context,
  projectId,
}: {
  context: ContentProjectContext;
  projectId: string;
}) => ["posts-presence", projectId, getContentContextCacheSignature(context)].join(":");

export const getContentRelationOptionsCacheKey = ({
  context,
  fieldKey,
  limit,
  projectId,
  search,
  selectedIds,
}: {
  context: ContentProjectContext;
  fieldKey: string;
  limit: number;
  projectId: string;
  search: string;
  selectedIds?: string[];
}) =>
  [
    "relation-options",
    projectId,
    getContentContextCacheSignature(context),
    fieldKey.trim(),
    limit,
    search.trim() || "__all__",
    [...new Set((selectedIds ?? []).map((value) => value.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right))
      .join(",") || "__none__",
  ].join(":");

export const getContentPostPayloadCacheKey = ({
  context,
  includeEditorOptions,
  postId,
  projectId,
}: {
  context: ContentProjectContext;
  includeEditorOptions: boolean;
  postId: string;
  projectId: string;
}) =>
  [
    "post-detail",
    projectId,
    postId.trim(),
    includeEditorOptions ? "full" : "shell",
    getContentContextCacheSignature(context),
  ].join(":");

export const getContentPostsCountCacheKey = ({
  context,
  projectId,
  scopeKey,
  search,
  status,
}: {
  context: ContentProjectContext;
  projectId: string;
  scopeKey: string;
  search: string;
  status: ContentPostsStatusFilter;
}) =>
  [
    "posts-count",
    projectId,
    getContentContextCacheSignature(context),
    scopeKey,
    status,
    search.trim() || "__all__",
  ].join(":");

export const getContentPostsQuerySnapshotCacheKey = ({
  cacheSignature,
  projectId,
  scopeKey,
  search,
  sort,
  status,
}: {
  cacheSignature: string;
  projectId: string;
  scopeKey: string;
  search: string;
  sort: ContentPostsSort;
  status: ContentPostsStatusFilter;
}) =>
  [
    "posts-query-snapshot:v1",
    projectId,
    cacheSignature,
    scopeKey,
    sort,
    status,
    search.trim().toLowerCase() || "__all__",
  ].join(":");

export const getContentWorkspaceCountsCacheKey = ({
  accessibleAuthorIds,
  filesStorageMode,
  hasFilesStorageCredential,
  hasMediaStorageCredential,
  mappingRevisionId,
  mappingRevisionVersion,
  mediaStorageMode,
  projectId,
}: {
  accessibleAuthorIds: string[] | null;
  filesStorageMode: string;
  hasFilesStorageCredential: boolean;
  hasMediaStorageCredential: boolean;
  mappingRevisionId: string | null;
  mappingRevisionVersion: number | null;
  mediaStorageMode: string;
  projectId: string;
}) =>
  [
    projectId,
    mappingRevisionId ?? "none",
    mappingRevisionVersion ?? 0,
    accessibleAuthorIds === null ? "*" : [...accessibleAuthorIds].sort().join(","),
    mediaStorageMode,
    filesStorageMode,
    hasMediaStorageCredential ? "media-creds" : "no-media-creds",
    hasFilesStorageCredential ? "files-creds" : "no-files-creds",
  ].join(":");

export const getContentEditorTaxonomyCacheKey = ({
  mapping,
  projectId,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
}) =>
  [
    "mapped-content-editor-taxonomy:v1",
    projectId,
    getContentMappingRevisionCacheKey(mapping),
  ].join(":");

export const getContentPostCacheKey = ({
  mapping,
  postId,
  projectId,
}: {
  mapping: ContentProjectMapping;
  postId: string;
  projectId: string;
}) =>
  [
    "mapped-content-post:v1",
    projectId,
    getContentMappingRevisionCacheKey(mapping),
    postId.trim(),
  ].join(":");

export const getContentPostAuthorCacheKey = ({
  mapping,
  postId,
  projectId,
}: {
  mapping: ContentProjectMapping;
  postId: string;
  projectId: string;
}) =>
  [
    "mapped-content-post-author:v1",
    projectId,
    getContentMappingRevisionCacheKey(mapping),
    postId.trim(),
  ].join(":");
