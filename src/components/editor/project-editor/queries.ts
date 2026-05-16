"use client";

import {
  keepPreviousData,
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { postsPageSize } from "@/components/editor/project-editor/constants";
import type {
  CollectionPagePayload,
  CollectionLabel,
  MappingDetectionPayload,
  MappingTableCatalogEntry,
  PostRevisionsResponse,
  PostsPagePayload,
  WorkspacePayload,
  WorkspaceSummaryPayload,
} from "@/components/editor/project-editor/types";
import type {
  ProjectAuthorsPayload,
} from "@/lib/control-plane/authors";
import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import type {
  ContentAuthor,
  ContentCategoriesPage,
  ContentFilesLibrary,
  ContentMediaLibrary,
  ContentPostEditorPayload,
  ContentPostEditingSession,
  ContentRelationFieldKey,
  ContentRelationOption,
  ContentTag,
} from "@/lib/content-runtime/shared";
import { hasFullContentEditorOptions } from "@/lib/content-runtime/shared";
import { retryContentRuntimeTransientErrors } from "@/lib/content-runtime/transient-retry";

const PROJECT_EDITOR_WORKSPACE_STALE_TIME_MS = 15_000;
const PROJECT_EDITOR_WORKSPACE_GC_TIME_MS = 60_000;
const PROJECT_EDITOR_REQUEST_TIMEOUT_MS = 15_000;
const PROJECT_EDITOR_MAPPING_REQUEST_TIMEOUT_MS = 30_000;
const PROJECT_EDITOR_POSTS_PAGE_STALE_TIME_MS = 10_000;
const PROJECT_EDITOR_POSTS_PAGE_GC_TIME_MS = 45_000;
const PROJECT_EDITOR_POST_PRESENCE_STALE_TIME_MS = 3_000;
const PROJECT_EDITOR_POST_PRESENCE_GC_TIME_MS = 15_000;
const PROJECT_EDITOR_POST_PAYLOAD_STALE_TIME_MS = 15_000;
const PROJECT_EDITOR_POST_PAYLOAD_GC_TIME_MS = 60_000;
const PROJECT_EDITOR_POST_REVISIONS_STALE_TIME_MS = 10_000;
const PROJECT_EDITOR_POST_REVISIONS_GC_TIME_MS = 60_000;
const PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS = 30_000;
const PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS = 60_000;

type ProjectEditorPostsPageQueryInput = {
  cursor?: string | null;
  page: number;
  pageSize?: number;
  projectId: string;
  search: string;
  sort: string;
  status: string;
};

type ProjectEditorPostPayloadQueryInput = {
  includeEditorOptions?: boolean;
  postId: string;
  projectId: string;
};

type ProjectEditorCollectionPageQueryInput = {
  page: number;
  pageSize?: number;
  projectId: string;
};

type ProjectEditorManagedStorageQueryInput = {
  cursor?: string | null;
  includeFolderOptions?: boolean;
  path?: string;
  projectId: string;
  search?: string;
};

type ProjectEditorRelationOptionsQueryInput = {
  fieldKey: ContentRelationFieldKey;
  limit?: number;
  projectId: string;
  search?: string;
  selectedIds?: string[];
};

type ProjectAuthorsManagerPageQueryInput = {
  includeMeta?: boolean;
  page: number;
  pageSize?: number;
  projectId: string;
};

type ProjectEditorCollectionSnapshotCacheKeyInput = {
  collection: CollectionLabel;
  page: number;
  pageSize: number;
  postsQueryCacheToken?: string;
  projectId: string;
};

type ProjectEditorPostsQueryCacheTokenInput = {
  search: string;
  sort: string;
  status: string;
};

const parseProjectEditorJson = async <T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> => {
  const payload = (await response.json()) as T;

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? fallbackMessage);
  }

  return payload;
};

const fetchProjectEditorJsonWithRetry = async <T>(
  input: string,
  fallbackMessage: string,
  options: {
    timeoutMs?: number;
  } = {},
) =>
  retryContentRuntimeTransientErrors(
    async () => {
      const abortController = new AbortController();
      const timeoutId = window.setTimeout(() => {
        abortController.abort(new DOMException(fallbackMessage, "TimeoutError"));
      }, options.timeoutMs ?? PROJECT_EDITOR_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(input, {
          cache: "no-store",
          signal: abortController.signal,
        });

        return parseProjectEditorJson<T>(response, fallbackMessage);
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "AbortError" || error.name === "TimeoutError")
        ) {
          throw new Error(`${fallbackMessage} The request timed out.`);
        }

        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    {
      delayMs: (attempt) => attempt * 500,
      maxAttempts: 2,
    },
  );

export const projectEditorQueryKeys = {
  authorsManagerPage: ({
    includeMeta = true,
    page,
    pageSize = 20,
    projectId,
  }: ProjectAuthorsManagerPageQueryInput) =>
    ["project-editor", projectId, "authors-manager-page", page, pageSize, includeMeta ? "full" : "rows"] as const,
  authorsPage: ({
    page,
    pageSize = postsPageSize,
    projectId,
  }: ProjectEditorCollectionPageQueryInput) =>
    ["project-editor", projectId, "authors-page", page, pageSize] as const,
  categoriesPage: ({
    page,
    pageSize = postsPageSize,
    projectId,
  }: ProjectEditorCollectionPageQueryInput) =>
    ["project-editor", projectId, "categories-page", page, pageSize] as const,
  filesLibrary: ({
    cursor = null,
    includeFolderOptions = false,
    path = "",
    projectId,
    search = "",
  }: ProjectEditorManagedStorageQueryInput) =>
    [
      "project-editor",
      projectId,
      "files-library",
      path,
      search.trim(),
      includeFolderOptions ? "full" : "lite",
      cursor?.trim() || "__first__",
    ] as const,
  mappingDetection: (projectId: string) =>
    ["project-editor", projectId, "mapping-detection"] as const,
  mediaLibrary: ({
    cursor = null,
    includeFolderOptions = false,
    path = "",
    projectId,
    search = "",
  }: ProjectEditorManagedStorageQueryInput) =>
    [
      "project-editor",
      projectId,
      "media-library",
      path,
      search.trim(),
      includeFolderOptions ? "full" : "lite",
      cursor?.trim() || "__first__",
    ] as const,
  post: ({ includeEditorOptions = true, postId, projectId }: ProjectEditorPostPayloadQueryInput) =>
    ["project-editor", projectId, "post", postId, includeEditorOptions ? "full" : "shell"] as const,
  relationOptions: ({
    fieldKey,
    limit = 100,
    projectId,
    search = "",
    selectedIds = [],
  }: ProjectEditorRelationOptionsQueryInput) =>
    [
      "project-editor",
      projectId,
      "relation-options",
      fieldKey,
      search.trim(),
      limit,
      [...new Set(selectedIds.map((value) => value.trim()).filter(Boolean))].sort().join(","),
    ] as const,
  postRevisions: (projectId: string, postId: string) =>
    ["project-editor", projectId, "post-revisions", postId] as const,
  postsPage: ({
    cursor,
    page,
    pageSize = postsPageSize,
    projectId,
    search,
    sort,
    status,
  }: ProjectEditorPostsPageQueryInput) =>
    ["project-editor", projectId, "posts-page", page, pageSize, sort, status, search, cursor?.trim() || "__offset__"] as const,
  postsPresence: (projectId: string) =>
    ["project-editor", projectId, "posts-presence"] as const,
  tagsPage: ({
    page,
    pageSize = postsPageSize,
    projectId,
  }: ProjectEditorCollectionPageQueryInput) =>
    ["project-editor", projectId, "tags-page", page, pageSize] as const,
  workspace: (projectId: string) =>
    ["project-editor", projectId, "workspace"] as const,
  workspaceSummary: (projectId: string) =>
    ["project-editor", projectId, "workspace-summary"] as const,
};

export const projectEditorQueryFamilies = {
  authorsManagerPages: (projectId: string) =>
    ["project-editor", projectId, "authors-manager-page"] as const,
  authorsPages: (projectId: string) =>
    ["project-editor", projectId, "authors-page"] as const,
  categoriesPages: (projectId: string) =>
    ["project-editor", projectId, "categories-page"] as const,
  filesLibraries: (projectId: string) =>
    ["project-editor", projectId, "files-library"] as const,
  postRevisions: (projectId: string) =>
    ["project-editor", projectId, "post-revisions"] as const,
  posts: (projectId: string) =>
    ["project-editor", projectId, "post"] as const,
  postsPresence: (projectId: string) =>
    ["project-editor", projectId, "posts-presence"] as const,
  mediaLibraries: (projectId: string) =>
    ["project-editor", projectId, "media-library"] as const,
  mappingDetection: (projectId: string) =>
    ["project-editor", projectId, "mapping-detection"] as const,
  relationOptions: (projectId: string, fieldKey?: ContentRelationFieldKey) =>
    [
      "project-editor",
      projectId,
      "relation-options",
      ...(fieldKey ? [fieldKey] : []),
    ] as const,
  postsPages: (projectId: string) =>
    ["project-editor", projectId, "posts-page"] as const,
  project: (projectId: string) =>
    ["project-editor", projectId] as const,
  tagsPages: (projectId: string) =>
    ["project-editor", projectId, "tags-page"] as const,
  workspace: (projectId: string) =>
    ["project-editor", projectId, "workspace"] as const,
  workspaceSummary: (projectId: string) =>
    ["project-editor", projectId, "workspace-summary"] as const,
};

export const projectEditorMutationInvalidationTargets = {
  collection: ({
    collection,
    projectId,
  }: {
    collection: CollectionLabel;
    projectId: string;
  }) => {
    if (collection === "Posts") {
      return [
        projectEditorQueryFamilies.postsPages(projectId),
        projectEditorQueryFamilies.postsPresence(projectId),
      ] as const;
    }

    if (collection === "Categories") {
      return [
        projectEditorQueryFamilies.categoriesPages(projectId),
        projectEditorQueryFamilies.relationOptions(projectId, "categories"),
      ] as const;
    }

    if (collection === "Tags") {
      return [
        projectEditorQueryFamilies.tagsPages(projectId),
        projectEditorQueryFamilies.relationOptions(projectId, "tags"),
      ] as const;
    }

    if (collection === "Authors") {
      return [
        projectEditorQueryFamilies.authorsPages(projectId),
        projectEditorQueryFamilies.authorsManagerPages(projectId),
        projectEditorQueryFamilies.relationOptions(projectId, "author"),
      ] as const;
    }

    if (collection === "Media") {
      return [projectEditorQueryFamilies.mediaLibraries(projectId)] as const;
    }

    return [projectEditorQueryFamilies.filesLibraries(projectId)] as const;
  },
  post: ({
    postId,
    projectId,
  }: {
    postId: string;
    projectId: string;
  }) =>
    [
      projectEditorQueryKeys.post({
        includeEditorOptions: false,
        postId,
        projectId,
      }),
      projectEditorQueryKeys.post({
        includeEditorOptions: true,
        postId,
        projectId,
      }),
      projectEditorQueryKeys.postRevisions(projectId, postId),
    ] as const,
  project: (projectId: string) =>
    [
      projectEditorQueryFamilies.workspace(projectId),
      projectEditorQueryFamilies.workspaceSummary(projectId),
      projectEditorQueryFamilies.postsPages(projectId),
      projectEditorQueryFamilies.postsPresence(projectId),
      projectEditorQueryFamilies.posts(projectId),
      projectEditorQueryFamilies.postRevisions(projectId),
      projectEditorQueryFamilies.relationOptions(projectId),
      projectEditorQueryFamilies.authorsPages(projectId),
      projectEditorQueryFamilies.authorsManagerPages(projectId),
      projectEditorQueryFamilies.categoriesPages(projectId),
      projectEditorQueryFamilies.tagsPages(projectId),
      projectEditorQueryFamilies.mediaLibraries(projectId),
      projectEditorQueryFamilies.filesLibraries(projectId),
      projectEditorQueryKeys.mappingDetection(projectId),
    ] as const,
};

export const projectEditorLocalCachePrefixes = {
  authorsManager: (projectId: string, version: number) =>
    `content-runtime:${projectId}:authors-manager:v${version}:`,
  collectionSnapshots: (projectId: string, collection?: CollectionLabel) =>
    `content-runtime:${projectId}:${collection ? `${collection}:` : ""}`,
  filesManager: (projectId: string, version: number) =>
    `content-runtime:${projectId}:files-manager:v${version}:`,
  mediaManager: (projectId: string, version: number) =>
    `content-runtime:${projectId}:media-manager:v${version}:`,
};

export const projectEditorLocalCacheKeys = {
  collectionSnapshot: ({
    collection,
    page,
    pageSize,
    postsQueryCacheToken,
    projectId,
  }: ProjectEditorCollectionSnapshotCacheKeyInput) =>
    `${projectEditorLocalCachePrefixes.collectionSnapshots(projectId, collection)}${page}:${pageSize}${collection === "Posts" && postsQueryCacheToken ? `:${postsQueryCacheToken}` : ""}`,
  discardableNewPosts: (projectId: string) =>
    `content-runtime:${projectId}:discardable-new-posts`,
};

export const getProjectEditorPostsQueryCacheToken = ({
  search,
  sort,
  status,
}: ProjectEditorPostsQueryCacheTokenInput) =>
  [sort, status, search || "__all__"].join(":");

export const getProjectEditorWorkspaceQueryOptions = ({
  initialData,
  projectId,
}: {
  initialData?: WorkspacePayload | null;
  projectId: string;
}) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_WORKSPACE_GC_TIME_MS,
    initialData: initialData ?? undefined,
    queryFn: () => fetchProjectEditorWorkspace(projectId),
    queryKey: projectEditorQueryKeys.workspace(projectId),
    staleTime: PROJECT_EDITOR_WORKSPACE_STALE_TIME_MS,
  });

export const getProjectEditorWorkspaceSummaryQueryOptions = ({
  initialData,
  projectId,
}: {
  initialData?: WorkspaceSummaryPayload | null;
  projectId: string;
}) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_WORKSPACE_GC_TIME_MS,
    initialData: initialData ?? undefined,
    queryFn: () => fetchProjectEditorWorkspaceSummary(projectId),
    queryKey: projectEditorQueryKeys.workspaceSummary(projectId),
    staleTime: PROJECT_EDITOR_WORKSPACE_STALE_TIME_MS,
  });

export const getProjectEditorPostsPageQueryOptions = ({
  cursor = null,
  page,
  pageSize = postsPageSize,
  projectId,
  search,
  sort,
  status,
}: ProjectEditorPostsPageQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_POSTS_PAGE_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchProjectEditorPostsPage({
        cursor,
        page,
        pageSize,
        projectId,
        search,
        sort,
        status,
      }),
    queryKey: projectEditorQueryKeys.postsPage({
      cursor,
      page,
      pageSize,
      projectId,
      search,
      sort,
      status,
    }),
    staleTime: PROJECT_EDITOR_POSTS_PAGE_STALE_TIME_MS,
  });

export const getProjectEditorPostsPresenceQueryOptions = ({
  projectId,
}: {
  projectId: string;
}) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_POST_PRESENCE_GC_TIME_MS,
    queryFn: () => fetchProjectEditorPostsPresence(projectId),
    queryKey: projectEditorQueryKeys.postsPresence(projectId),
    staleTime: PROJECT_EDITOR_POST_PRESENCE_STALE_TIME_MS,
  });

export const getProjectEditorCategoriesPageQueryOptions = ({
  page,
  pageSize = postsPageSize,
  projectId,
}: ProjectEditorCollectionPageQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchProjectEditorCategoriesPage({
        page,
        pageSize,
        projectId,
      }),
    queryKey: projectEditorQueryKeys.categoriesPage({
      page,
      pageSize,
      projectId,
    }),
    staleTime: PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS,
  });

export const getProjectEditorTagsPageQueryOptions = ({
  page,
  pageSize = postsPageSize,
  projectId,
}: ProjectEditorCollectionPageQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchProjectEditorTagsPage({
        page,
        pageSize,
        projectId,
      }),
    queryKey: projectEditorQueryKeys.tagsPage({
      page,
      pageSize,
      projectId,
    }),
    staleTime: PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS,
  });

export const getProjectEditorAuthorsPageQueryOptions = ({
  page,
  pageSize = postsPageSize,
  projectId,
}: ProjectEditorCollectionPageQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchProjectEditorAuthorsPage({
        page,
        pageSize,
        projectId,
      }),
    queryKey: projectEditorQueryKeys.authorsPage({
      page,
      pageSize,
      projectId,
    }),
    staleTime: PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS,
  });

export const getProjectEditorRelationOptionsQueryOptions = ({
  fieldKey,
  limit = 100,
  projectId,
  search = "",
  selectedIds = [],
}: ProjectEditorRelationOptionsQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS,
    queryFn: () =>
      fetchProjectEditorRelationOptions({
        fieldKey,
        limit,
        projectId,
        search,
        selectedIds,
      }),
    queryKey: projectEditorQueryKeys.relationOptions({
      fieldKey,
      limit,
      projectId,
      search,
      selectedIds,
    }),
    staleTime: PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS,
  });

export const getProjectAuthorsManagerPageQueryOptions = ({
  includeMeta = true,
  page,
  pageSize = 20,
  projectId,
}: ProjectAuthorsManagerPageQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchProjectAuthorsManagerPage({
        includeMeta,
        page,
        pageSize,
        projectId,
      }),
    queryKey: projectEditorQueryKeys.authorsManagerPage({
      includeMeta,
      page,
      pageSize,
      projectId,
    }),
    staleTime: PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS,
  });

export const getProjectEditorMediaLibraryQueryOptions = ({
  cursor = null,
  includeFolderOptions = false,
  path = "",
  projectId,
  search = "",
}: ProjectEditorManagedStorageQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS,
    queryFn: () =>
      fetchProjectEditorMediaLibrary({
        cursor,
        includeFolderOptions,
        path,
        projectId,
        search,
      }),
    queryKey: projectEditorQueryKeys.mediaLibrary({
      includeFolderOptions,
      cursor,
      path,
      projectId,
      search,
    }),
    staleTime: PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS,
  });

export const getProjectEditorFilesLibraryQueryOptions = ({
  cursor = null,
  includeFolderOptions = false,
  path = "",
  projectId,
  search = "",
}: ProjectEditorManagedStorageQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_COLLECTION_PAGE_GC_TIME_MS,
    queryFn: () =>
      fetchProjectEditorFilesLibrary({
        cursor,
        includeFolderOptions,
        path,
        projectId,
        search,
      }),
    queryKey: projectEditorQueryKeys.filesLibrary({
      includeFolderOptions,
      cursor,
      path,
      projectId,
      search,
    }),
    staleTime: PROJECT_EDITOR_COLLECTION_PAGE_STALE_TIME_MS,
  });

export const getProjectEditorPostPayloadQueryOptions = ({
  includeEditorOptions = true,
  postId,
  projectId,
}: ProjectEditorPostPayloadQueryInput) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_POST_PAYLOAD_GC_TIME_MS,
    queryFn: () =>
      fetchProjectEditorPostPayload({
        includeEditorOptions,
        postId,
        projectId,
      }),
    queryKey: projectEditorQueryKeys.post({
      includeEditorOptions,
      postId,
      projectId,
    }),
    refetchOnMount: (query) => {
      const cachedPayload = query.state.data as ContentPostEditorPayload | undefined;

      if (includeEditorOptions && cachedPayload && !hasFullContentEditorOptions(cachedPayload)) {
        return "always";
      }

      return true;
    },
    staleTime: PROJECT_EDITOR_POST_PAYLOAD_STALE_TIME_MS,
  });

export const getProjectEditorPostRevisionsQueryOptions = ({
  postId,
  projectId,
}: {
  postId: string;
  projectId: string;
}) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_POST_REVISIONS_GC_TIME_MS,
    queryFn: () =>
      fetchProjectEditorPostRevisions({
        postId,
        projectId,
      }),
    queryKey: projectEditorQueryKeys.postRevisions(projectId, postId),
    staleTime: PROJECT_EDITOR_POST_REVISIONS_STALE_TIME_MS,
  });

export const getProjectEditorMappingDetectionQueryOptions = ({
  projectId,
}: {
  projectId: string;
}) =>
  queryOptions({
    gcTime: PROJECT_EDITOR_WORKSPACE_GC_TIME_MS,
    queryFn: () => fetchProjectEditorMappingDetection(projectId),
    queryKey: projectEditorQueryKeys.mappingDetection(projectId),
    staleTime: PROJECT_EDITOR_WORKSPACE_STALE_TIME_MS,
  });

export const fetchProjectEditorWorkspace = async (projectId: string): Promise<WorkspacePayload> => {
  const response = await fetch(`/api/projects/${projectId}/content/workspace`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<WorkspacePayload>(response, "Could not load this project.");
};

export const fetchProjectEditorWorkspaceSummary = async (
  projectId: string,
): Promise<WorkspaceSummaryPayload> => {
  const response = await fetch(`/api/projects/${projectId}/content/workspace-counts`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<WorkspaceSummaryPayload>(
    response,
    "Could not refresh workspace counts right now.",
  );
};

export const fetchProjectEditorPostsPage = async ({
  cursor = null,
  page,
  pageSize = postsPageSize,
  projectId,
  search,
  sort,
  status,
}: ProjectEditorPostsPageQueryInput): Promise<PostsPagePayload> => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
  });

  if (status !== "all") {
    searchParams.set("status", status);
  }

  if (search) {
    searchParams.set("search", search);
  }

  if (cursor?.trim()) {
    searchParams.set("cursor", cursor.trim());
  }

  const response = await fetch(`/api/projects/${projectId}/content/posts?${searchParams.toString()}`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<PostsPagePayload>(response, "Could not load this collection right now.");
};

export const fetchProjectEditorPostsPresence = async (
  projectId: string,
): Promise<{
  sessions: Array<{ editingSession: ContentPostEditingSession; postId: string }>;
}> => {
  const response = await fetch(`/api/projects/${projectId}/content/posts/presence`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<{
    sessions: Array<{ editingSession: ContentPostEditingSession; postId: string }>;
  }>(response, "Could not refresh post activity right now.");
};

export const fetchProjectEditorCategoriesPage = async ({
  page,
  pageSize = postsPageSize,
  projectId,
}: ProjectEditorCollectionPageQueryInput): Promise<ContentCategoriesPage> => {
  const searchParams = new URLSearchParams({
    includeAllCategories: "false",
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/projects/${projectId}/content/categories?${searchParams.toString()}`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<ContentCategoriesPage>(
    response,
    "Could not load this collection right now.",
  );
};

export const fetchProjectEditorTagsPage = async ({
  page,
  pageSize = postsPageSize,
  projectId,
}: ProjectEditorCollectionPageQueryInput): Promise<CollectionPagePayload<ContentTag>> => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/projects/${projectId}/content/tags?${searchParams.toString()}`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<CollectionPagePayload<ContentTag>>(
    response,
    "Could not load this collection right now.",
  );
};

export const fetchProjectEditorAuthorsPage = async ({
  page,
  pageSize = postsPageSize,
  projectId,
}: ProjectEditorCollectionPageQueryInput): Promise<CollectionPagePayload<ContentAuthor>> => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/projects/${projectId}/content/authors?${searchParams.toString()}`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<CollectionPagePayload<ContentAuthor>>(
    response,
    "Could not load this collection right now.",
  );
};

export const fetchProjectEditorContentCollectionPage = async <T>({
  page,
  pageSize = postsPageSize,
  projectId,
  view,
}: ProjectEditorCollectionPageQueryInput & {
  view: string;
}): Promise<CollectionPagePayload<T>> => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    view,
  });
  const response = await fetch(`/api/projects/${projectId}/content?${searchParams.toString()}`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<CollectionPagePayload<T>>(
    response,
    "Could not load this collection right now.",
  );
};

export const fetchProjectEditorRelationOptions = async ({
  fieldKey,
  limit = 100,
  projectId,
  search = "",
  selectedIds = [],
}: ProjectEditorRelationOptionsQueryInput): Promise<ContentRelationOption[]> => {
  const normalizedSearch = search.trim();
  const searchParams = new URLSearchParams();

  searchParams.append("view", "relation_options");
  searchParams.append("fieldKey", fieldKey);

  if (normalizedSearch) {
    searchParams.append("search", normalizedSearch);
  }

  for (const selectedId of [...new Set(selectedIds.map((value) => value.trim()).filter(Boolean))]) {
    searchParams.append("selectedId", selectedId);
  }

  searchParams.append("limit", String(limit));

  const response = await fetch(`/api/projects/${projectId}/content?${searchParams.toString()}`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<ContentRelationOption[]>(
    response,
    "Could not load relation options right now.",
  );
};

export const fetchProjectAuthorsManagerPage = async ({
  includeMeta = true,
  page,
  pageSize = 20,
  projectId,
}: ProjectAuthorsManagerPageQueryInput): Promise<ProjectAuthorsPayload> => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (!includeMeta) {
    searchParams.set("includeMeta", "false");
  }

  const response = await fetch(`/api/projects/${projectId}/authors?${searchParams.toString()}`, {
    cache: "no-store",
  });

  return parseProjectEditorJson<ProjectAuthorsPayload>(
    response,
    "Could not load project authors right now.",
  );
};

export const fetchProjectEditorMediaLibrary = async ({
  cursor = null,
  includeFolderOptions = false,
  path = "",
  projectId,
  search = "",
}: ProjectEditorManagedStorageQueryInput): Promise<ContentMediaLibrary> => {
  const normalizedSearch = search.trim();
  const searchParams = new URLSearchParams();

  searchParams.set("includeFolderOptions", includeFolderOptions ? "true" : "false");

  if (path) {
    searchParams.set("path", path);
  }

  if (normalizedSearch) {
    searchParams.set("search", normalizedSearch);
  }

  if (cursor?.trim()) {
    searchParams.set("cursor", cursor.trim());
  }

  return fetchProjectEditorJsonWithRetry<ContentMediaLibrary>(
    `/api/projects/${projectId}/media?${searchParams.toString()}`,
    "Could not load the media library right now.",
  );
};

export const fetchProjectEditorFilesLibrary = async ({
  cursor = null,
  includeFolderOptions = false,
  path = "",
  projectId,
  search = "",
}: ProjectEditorManagedStorageQueryInput): Promise<ContentFilesLibrary> => {
  const normalizedSearch = search.trim();
  const searchParams = new URLSearchParams();

  searchParams.set("includeFolderOptions", includeFolderOptions ? "true" : "false");

  if (path) {
    searchParams.set("path", path);
  }

  if (normalizedSearch) {
    searchParams.set("search", normalizedSearch);
  }

  if (cursor?.trim()) {
    searchParams.set("cursor", cursor.trim());
  }

  return fetchProjectEditorJsonWithRetry<ContentFilesLibrary>(
    `/api/projects/${projectId}/files?${searchParams.toString()}`,
    "Could not load the files library right now.",
  );
};

export const fetchProjectEditorStoredMapping = async (
  projectId: string,
): Promise<ContentProjectMapping & {
  availableSupabaseBuckets?: unknown[];
  error?: string;
  filesStorageCredentialStatus?: {
    hasS3AccessKeyId?: boolean;
    hasS3SecretAccessKey?: boolean;
  };
  mediaStorageCredentialStatus?: {
    hasS3AccessKeyId?: boolean;
    hasS3SecretAccessKey?: boolean;
  };
}> =>
  fetchProjectEditorJsonWithRetry(
    `/api/projects/${projectId}/content?view=mapping`,
    "Could not load mapping data right now.",
    {
      timeoutMs: PROJECT_EDITOR_MAPPING_REQUEST_TIMEOUT_MS,
    },
  );

export const fetchProjectEditorPostPayload = async ({
  includeEditorOptions = true,
  postId,
  projectId,
}: ProjectEditorPostPayloadQueryInput): Promise<ContentPostEditorPayload> => {
  const searchParams = new URLSearchParams();

  if (!includeEditorOptions) {
    searchParams.set("includeEditorOptions", "false");
  }

  const route = `/api/projects/${projectId}/content/posts/${encodeURIComponent(postId)}`;
  const response = await fetch(
    searchParams.size ? `${route}?${searchParams.toString()}` : route,
    {
      cache: "no-store",
    },
  );

  return parseProjectEditorJson<ContentPostEditorPayload>(
    response,
    "Could not load this post right now.",
  );
};

export const fetchProjectEditorPostRevisions = async ({
  postId,
  projectId,
}: {
  postId: string;
  projectId: string;
}): Promise<PostRevisionsResponse> => {
  const response = await fetch(
    `/api/projects/${projectId}/content/posts/${encodeURIComponent(postId)}/revisions`,
    {
      cache: "no-store",
    },
  );

  return parseProjectEditorJson<PostRevisionsResponse>(
    response,
    "Could not load revision history right now.",
  );
};

export const fetchProjectEditorMappingDetection = async (
  projectId: string,
  options?: {
    tableRef?: string | null;
  },
): Promise<MappingDetectionPayload> => {
  const searchParams = new URLSearchParams({
    view: "mapping_detection",
  });

  const tableRef = options?.tableRef?.trim();

  if (tableRef) {
    searchParams.set("tableRef", tableRef);
  }

  return fetchProjectEditorJsonWithRetry<MappingDetectionPayload>(
    `/api/projects/${projectId}/content?${searchParams.toString()}`,
    "Could not load the detected mapping right now.",
    {
      timeoutMs: PROJECT_EDITOR_MAPPING_REQUEST_TIMEOUT_MS,
    },
  );
};

export const fetchProjectEditorMappingTableCatalog = async (
  projectId: string,
  options: {
    refresh?: boolean;
  } = {},
): Promise<MappingTableCatalogEntry[]> => {
  const searchParams = new URLSearchParams({
    view: "mapping_tables",
  });

  if (options.refresh) {
    searchParams.set("refresh", "true");
  }

  const payload = await fetchProjectEditorJsonWithRetry<{
    error?: string;
    tables: MappingTableCatalogEntry[];
  }>(
    `/api/projects/${projectId}/content?${searchParams.toString()}`,
    "Could not load the available mapping tables right now.",
    {
      timeoutMs: PROJECT_EDITOR_MAPPING_REQUEST_TIMEOUT_MS,
    },
  );

  return payload.tables ?? [];
};

export const useProjectEditorWorkspaceQuery = ({
  enabled = true,
  initialData,
  projectId,
}: {
  enabled?: boolean;
  initialData?: WorkspacePayload | null;
  projectId: string;
}): UseQueryResult<WorkspacePayload, Error> =>
  useQuery({
    ...getProjectEditorWorkspaceQueryOptions({
      initialData,
      projectId,
    }),
    enabled,
  });

export const useProjectEditorWorkspaceSummaryQuery = ({
  enabled = true,
  initialData,
  projectId,
}: {
  enabled?: boolean;
  initialData?: WorkspaceSummaryPayload | null;
  projectId: string;
}): UseQueryResult<WorkspaceSummaryPayload, Error> =>
  useQuery({
    ...getProjectEditorWorkspaceSummaryQueryOptions({
      initialData,
      projectId,
    }),
    enabled,
  });

export const useProjectEditorPostsPageQuery = ({
  cursor = null,
  enabled = true,
  page,
  pageSize = postsPageSize,
  projectId,
  search,
  sort,
  status,
}: {
  cursor?: string | null;
  enabled?: boolean;
  page: number;
  pageSize?: number;
  projectId: string;
  search: string;
  sort: string;
  status: string;
}): UseQueryResult<PostsPagePayload, Error> =>
  useQuery({
    ...getProjectEditorPostsPageQueryOptions({
      cursor,
      page,
      pageSize,
      projectId,
      search,
      sort,
      status,
    }),
    enabled,
  });

export const useProjectEditorPostsPresenceQuery = ({
  enabled = true,
  projectId,
  refetchIntervalMs = 5_000,
}: {
  enabled?: boolean;
  projectId: string;
  refetchIntervalMs?: number;
}): UseQueryResult<
  {
    sessions: Array<{ editingSession: ContentPostEditingSession; postId: string }>;
  },
  Error
> =>
  useQuery({
    ...getProjectEditorPostsPresenceQueryOptions({
      projectId,
    }),
    enabled,
    refetchInterval:
      enabled && (typeof document === "undefined" || document.visibilityState === "visible")
        ? refetchIntervalMs
        : false,
    refetchIntervalInBackground: false,
  });

export const useProjectEditorRelationOptionsQuery = ({
  enabled = true,
  fieldKey,
  limit = 100,
  projectId,
  search = "",
  selectedIds = [],
}: {
  enabled?: boolean;
  fieldKey: ContentRelationFieldKey;
  limit?: number;
  projectId: string;
  search?: string;
  selectedIds?: string[];
}): UseQueryResult<ContentRelationOption[], Error> =>
  useQuery({
    ...getProjectEditorRelationOptionsQueryOptions({
      fieldKey,
      limit,
      projectId,
      search,
      selectedIds,
    }),
    enabled,
  });

export const useProjectEditorPostPayloadQuery = ({
  enabled = true,
  includeEditorOptions = true,
  postId,
  projectId,
}: {
  enabled?: boolean;
  includeEditorOptions?: boolean;
  postId: string | null;
  projectId: string;
}): UseQueryResult<ContentPostEditorPayload, Error> => {
  const queryClient = useQueryClient();

  return useQuery({
    ...getProjectEditorPostPayloadQueryOptions({
      includeEditorOptions,
      postId: postId ?? "__missing__",
      projectId,
    }),
    enabled: enabled && Boolean(postId),
    placeholderData: () => {
      if (!postId) {
        return undefined;
      }

      return (
        queryClient.getQueryData<ContentPostEditorPayload>(
          projectEditorQueryKeys.post({
            includeEditorOptions,
            postId,
            projectId,
          }),
        ) ??
        queryClient.getQueryData<ContentPostEditorPayload>(
          projectEditorQueryKeys.post({
            includeEditorOptions: false,
            postId,
            projectId,
          }),
        )
      );
    },
  });
};

export const useProjectEditorPostRevisionsQuery = ({
  enabled = true,
  postId,
  projectId,
}: {
  enabled?: boolean;
  postId: string | null;
  projectId: string;
}): UseQueryResult<PostRevisionsResponse, Error> =>
  useQuery({
    ...getProjectEditorPostRevisionsQueryOptions({
      postId: postId ?? "__missing__",
      projectId,
    }),
    enabled: enabled && Boolean(postId),
  });

export const useProjectEditorMappingDetectionQuery = ({
  enabled = true,
  projectId,
}: {
  enabled?: boolean;
  projectId: string;
}): UseQueryResult<MappingDetectionPayload, Error> =>
  useQuery({
    ...getProjectEditorMappingDetectionQueryOptions({
      projectId,
    }),
    enabled,
  });

export const primeProjectEditorPostPayloadQueryData = (
  queryClient: QueryClient,
  {
    payload,
    projectId,
  }: {
    payload: ContentPostEditorPayload;
    projectId: string;
  },
) => {
  queryClient.setQueryData(
    projectEditorQueryKeys.post({
      includeEditorOptions: false,
      postId: payload.post.id,
      projectId,
    }),
    payload,
  );

  if (hasFullContentEditorOptions(payload)) {
    queryClient.setQueryData(
      projectEditorQueryKeys.post({
        includeEditorOptions: true,
        postId: payload.post.id,
        projectId,
      }),
      payload,
    );
  }
};
