"use client";

import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { defaultPagination } from "@/components/editor/project-editor/constants";
import {
  getProjectAuthorsManagerPageQueryOptions,
  getProjectEditorCategoriesPageQueryOptions,
  getProjectEditorFilesLibraryQueryOptions,
  getProjectEditorMediaLibraryQueryOptions,
  getProjectEditorTagsPageQueryOptions,
} from "@/components/editor/project-editor/queries";
import type { CollectionLabel } from "@/components/editor/project-editor/types";
import type { ProjectEditorCollectionAvailability } from "@/components/editor/project-editor/utils";

type ManagedStorageSectionState = {
  currentPath: string;
  searchQuery: string;
};

type UseProjectEditorPrefetchParams = {
  collectionAvailabilityByLabel: Record<CollectionLabel, ProjectEditorCollectionAvailability>;
  collectionPages: Record<CollectionLabel, number>;
  filesSectionState: ManagedStorageSectionState;
  mediaSectionState: ManagedStorageSectionState;
  projectId: string;
  queryClient: QueryClient;
  usesManagedFilesLibrary: boolean;
  usesManagedMediaLibrary: boolean;
};

export const useProjectEditorPrefetch = ({
  collectionAvailabilityByLabel,
  collectionPages,
  filesSectionState,
  mediaSectionState,
  projectId,
  queryClient,
  usesManagedFilesLibrary,
  usesManagedMediaLibrary,
}: UseProjectEditorPrefetchParams) => {
  const prefetchSidebarCollection = useCallback((collection: CollectionLabel) => {
    if (collectionAvailabilityByLabel[collection] !== "ready") {
      return;
    }

    if (collection === "Authors") {
      void import("@/components/editor/project-authors-manager");
      void queryClient.prefetchQuery(
        getProjectAuthorsManagerPageQueryOptions({
          includeMeta: true,
          page: collectionPages.Authors,
          pageSize: 20,
          projectId,
        }),
      );
      return;
    }

    if (collection === "Categories") {
      void import("@/components/editor/project-editor/taxonomy-ui");
      void queryClient.prefetchQuery(
        getProjectEditorCategoriesPageQueryOptions({
          page: 1,
          pageSize: defaultPagination.pageSize,
          projectId,
        }),
      );
      return;
    }

    if (collection === "Tags") {
      void import("@/components/editor/project-editor/taxonomy-ui");
      void queryClient.prefetchQuery(
        getProjectEditorTagsPageQueryOptions({
          page: 1,
          pageSize: defaultPagination.pageSize,
          projectId,
        }),
      );
      return;
    }

    if (collection === "Media" && usesManagedMediaLibrary) {
      void import("@/components/editor/project-media-manager");
      void queryClient.prefetchQuery(
        getProjectEditorMediaLibraryQueryOptions({
          includeFolderOptions: false,
          path: mediaSectionState.currentPath,
          projectId,
          search: mediaSectionState.searchQuery,
        }),
      );
      return;
    }

    if (collection === "Files" && usesManagedFilesLibrary) {
      void import("@/components/editor/project-files-manager");
      void queryClient.prefetchQuery(
        getProjectEditorFilesLibraryQueryOptions({
          includeFolderOptions: false,
          path: filesSectionState.currentPath,
          projectId,
          search: filesSectionState.searchQuery,
        }),
      );
    }
  }, [
    collectionAvailabilityByLabel,
    collectionPages.Authors,
    filesSectionState.currentPath,
    filesSectionState.searchQuery,
    mediaSectionState.currentPath,
    mediaSectionState.searchQuery,
    projectId,
    queryClient,
    usesManagedFilesLibrary,
    usesManagedMediaLibrary,
  ]);

  const prefetchProjectSettings = useCallback(() => {
    void import("@/components/editor/project-editor/settings-view");
  }, []);

  return {
    prefetchProjectSettings,
    prefetchSidebarCollection,
  };
};
