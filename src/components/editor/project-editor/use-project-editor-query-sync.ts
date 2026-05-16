"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";

import {
  getProjectEditorPostPayloadQueryOptions,
  primeProjectEditorPostPayloadQueryData,
  projectEditorMutationInvalidationTargets,
  projectEditorQueryFamilies,
  projectEditorQueryKeys,
} from "@/components/editor/project-editor/queries";
import type {
  CollectionLabel,
  PostsPagePayload,
  WorkspacePayload,
  WorkspaceSummaryPayload,
} from "@/components/editor/project-editor/types";
import {
  forgetProjectEditorCollectionSnapshots,
  rememberProjectEditorCollectionSnapshot,
} from "@/components/editor/project-editor/utils";
import {
  hasFullContentEditorOptions,
  type ContentPostEditorPayload,
  type ContentPostsSort,
  type ContentPostsStatusFilter,
} from "@/lib/content-runtime/shared";

type UseProjectEditorQuerySyncParams = {
  normalizedPostsSearchQuery: string;
  postsSort: ContentPostsSort;
  postsStatusFilter: ContentPostsStatusFilter;
  projectId: string;
  queryClient: QueryClient;
  setResolvedCollectionCacheKeys: Dispatch<SetStateAction<string[]>>;
};

export const useProjectEditorQuerySync = ({
  normalizedPostsSearchQuery,
  postsSort,
  postsStatusFilter,
  projectId,
  queryClient,
  setResolvedCollectionCacheKeys,
}: UseProjectEditorQuerySyncParams) => {
  const syncWorkspaceQueryData = useCallback(
    (payload: WorkspacePayload) => {
      queryClient.setQueryData(projectEditorQueryKeys.workspace(projectId), payload);
    },
    [projectId, queryClient],
  );

  const syncWorkspaceSummaryQueryData = useCallback(
    (payload: WorkspaceSummaryPayload) => {
      queryClient.setQueryData(projectEditorQueryKeys.workspaceSummary(projectId), payload);
    },
    [projectId, queryClient],
  );

  const syncPostsPageQueryData = useCallback(
    (page: number, payload: PostsPagePayload) => {
      queryClient.setQueryData(
        projectEditorQueryKeys.postsPage({
          page,
          projectId,
          search: normalizedPostsSearchQuery,
          sort: postsSort,
          status: postsStatusFilter,
        }),
        payload,
      );
    },
    [normalizedPostsSearchQuery, postsSort, postsStatusFilter, projectId, queryClient],
  );

  const syncPostPayloadQueryData = useCallback(
    (payload: ContentPostEditorPayload) => {
      primeProjectEditorPostPayloadQueryData(queryClient, {
        payload,
        projectId,
      });

      if (!hasFullContentEditorOptions(payload)) {
        queryClient.removeQueries({
          exact: true,
          queryKey: projectEditorQueryKeys.post({
            includeEditorOptions: true,
            postId: payload.post.id,
            projectId,
          }),
        });
      }
    },
    [projectId, queryClient],
  );

  const prefetchPostPayloadQueryData = useCallback(
    (postId: string) => {
      void queryClient.prefetchQuery(
        getProjectEditorPostPayloadQueryOptions({
          includeEditorOptions: false,
          postId,
          projectId,
        }),
      );
    },
    [projectId, queryClient],
  );

  const removePostPayloadQueryData = useCallback(
    (postId: string) => {
      for (const queryKey of projectEditorMutationInvalidationTargets.post({
        postId,
        projectId,
      })) {
        queryClient.removeQueries({
          exact: true,
          queryKey,
        });
      }
    },
    [projectId, queryClient],
  );

  const invalidateWorkspaceCache = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: projectEditorQueryFamilies.workspace(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: projectEditorQueryFamilies.workspaceSummary(projectId),
    });
  }, [projectId, queryClient]);

  const invalidateWorkspaceSummaryCache = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: projectEditorQueryFamilies.workspaceSummary(projectId),
    });
  }, [projectId, queryClient]);

  const rememberResolvedCollectionSnapshot = useCallback((cacheKey: string) => {
    setResolvedCollectionCacheKeys((currentKeys) =>
      rememberProjectEditorCollectionSnapshot(currentKeys, cacheKey),
    );
  }, [setResolvedCollectionCacheKeys]);

  const invalidateCollectionCache = useCallback((collection?: CollectionLabel) => {
    if (!collection) {
      for (const queryKey of projectEditorMutationInvalidationTargets.project(projectId)) {
        queryClient.removeQueries({
          queryKey,
        });
      }
      setResolvedCollectionCacheKeys([]);
      return;
    }

    for (const queryKey of projectEditorMutationInvalidationTargets.collection({
      collection,
      projectId,
    })) {
      void queryClient.invalidateQueries({
        queryKey,
      });
    }

    setResolvedCollectionCacheKeys((currentKeys) =>
      forgetProjectEditorCollectionSnapshots({
        collection,
        projectId,
        snapshotKeys: currentKeys,
      }),
    );
  }, [projectId, queryClient, setResolvedCollectionCacheKeys]);

  return {
    invalidateCollectionCache,
    invalidateWorkspaceCache,
    invalidateWorkspaceSummaryCache,
    prefetchPostPayloadQueryData,
    rememberResolvedCollectionSnapshot,
    removePostPayloadQueryData,
    syncPostPayloadQueryData,
    syncPostsPageQueryData,
    syncWorkspaceQueryData,
    syncWorkspaceSummaryQueryData,
  };
};
