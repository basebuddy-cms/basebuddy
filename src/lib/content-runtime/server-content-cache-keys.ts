import type { ContentProjectMapping } from "./mapping";
import { getContentMappingRevisionCacheKey } from "./mapped-content-runtime-support";

export const getContentWorkspaceRuntimeSignature = ({
  filesStorageMode,
  mapping,
  mediaStorageMode,
}: {
  filesStorageMode: string;
  mapping: Pick<ContentProjectMapping, "revisionId" | "revisionVersion">;
  mediaStorageMode: string;
}) =>
  [
    "mapped_content",
    mapping.revisionId ?? "none",
    mapping.revisionVersion ?? 0,
    mediaStorageMode,
    filesStorageMode,
  ].join(":");

export const getContentPostProjectionRefreshKey = ({
  mapping,
  postIds,
  projectId,
}: {
  mapping: Pick<ContentProjectMapping, "bindingId" | "revisionId" | "revisionVersion">;
  postIds?: string[] | null;
  projectId: string;
}) =>
  [
    projectId,
    mapping.bindingId,
    mapping.revisionId ?? "none",
    mapping.revisionVersion ?? 0,
    ...(postIds ?? ["*"]),
  ].join(":");

export const getContentCategoriesHierarchyCacheKey = ({
  mapping,
  projectId,
}: {
  mapping: ContentProjectMapping;
  projectId: string;
}) =>
  [
    "mapped-content-categories-hierarchy:v1",
    projectId,
    getContentMappingRevisionCacheKey(mapping),
  ].join(":");
