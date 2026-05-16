"use client";

import React from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  ProjectEditorContentCollectionSetupCard,
  ProjectEditorPostsMappingDraftEntry,
} from "@/components/editor/project-editor/mapping-draft-view";
import {
  ProjectEditorConnectionErrorState,
  ProjectEditorEmptyCollectionState,
  ProjectEditorPostEditorSkeleton,
  ProjectEditorPostLoadErrorState,
  ProjectEditorPostsListSkeleton,
  ProjectEditorScrollPane,
  ProjectEditorSidebarEntriesList,
  ProjectEditorStateCard,
  ProjectEditorTablePageSkeleton,
} from "@/components/editor/project-editor/collection-body";
import type {
  CollectionLabel,
  SidebarCollectionEntry,
} from "@/components/editor/project-editor/types";
import {
  getProjectEditorCollectionSetupCopy,
  getProjectEditorWorkspaceNotReadyCopy,
} from "@/components/editor/project-editor/utils";
import type { ContentWorkspaceState } from "@/lib/content-runtime/shared";

type ProjectEditorCollectionBodyInput = {
  authorsPage: ReactNode;
  canUpdateProject: boolean;
  categoriesPage: ReactNode;
  entries: SidebarCollectionEntry[];
  filesPage: ReactNode;
  hasCurrentCollectionSnapshot: boolean;
  isContentProject: boolean;
  isContentReady: boolean;
  isCurrentPostBlocked: boolean;
  isLoadingCollection: boolean;
  isPostsCollection: boolean;
  isSelectedCollectionVisible: boolean;
  isSettingsView: boolean;
  loadingMessage: string | null;
  mediaPage: ReactNode;
  onOpenMappedContentMappingDialog: (collection: CollectionLabel) => void;
  postBlockedState: ReactNode;
  postContentView: "list" | "editor";
  postEditorBody: ReactNode;
  postsCollectionPage: ReactNode;
  projectConnectionError: string | null;
  resolvedWorkspace: unknown;
  selectedCollection: CollectionLabel;
  selectedCollectionAvailability: string;
  selectedCollectionIcon: LucideIcon;
  selectedPost: unknown;
  selectedPostLoadError: string | null;
  settingsView: ReactNode;
  sidebarEntriesPagination: ReactNode;
  shouldShowInitialPostsListSkeleton: boolean;
  shouldShowPostRouteLoadingState: boolean;
  tagsPage: ReactNode;
  workspaceState: ContentWorkspaceState;
};

type ProjectEditorSidePanelInput = {
  isContentReady: boolean;
  isPostsCollection: boolean;
  isSettingsView: boolean;
  postContentView: "list" | "editor";
  postSidePanel: ReactNode;
  selectedCollection: CollectionLabel;
  showSeoPanel: boolean;
  taxonomySidePanel: ReactNode;
};

export const renderProjectEditorCollectionBody = ({
  authorsPage,
  canUpdateProject,
  categoriesPage,
  entries,
  filesPage,
  hasCurrentCollectionSnapshot,
  isContentProject,
  isContentReady,
  isCurrentPostBlocked,
  isLoadingCollection,
  isPostsCollection,
  isSelectedCollectionVisible,
  isSettingsView,
  loadingMessage,
  mediaPage,
  onOpenMappedContentMappingDialog,
  postBlockedState,
  postContentView,
  postEditorBody,
  postsCollectionPage,
  projectConnectionError,
  resolvedWorkspace,
  selectedCollection,
  selectedCollectionAvailability,
  selectedCollectionIcon,
  selectedPost,
  selectedPostLoadError,
  settingsView,
  sidebarEntriesPagination,
  shouldShowInitialPostsListSkeleton,
  shouldShowPostRouteLoadingState,
  tagsPage,
  workspaceState,
}: ProjectEditorCollectionBodyInput) => {
  if (isSettingsView) {
    return settingsView;
  }

  if (resolvedWorkspace && !isSelectedCollectionVisible) {
    return <ProjectEditorPostsListSkeleton />;
  }

  if (selectedCollection === "Posts" && postContentView !== "editor" && shouldShowInitialPostsListSkeleton) {
    return <ProjectEditorPostsListSkeleton />;
  }

  if (
    isContentProject &&
    selectedCollection !== "Posts" &&
    selectedCollectionAvailability === "unmapped"
  ) {
    const setupCopy = getProjectEditorCollectionSetupCopy(selectedCollection, {
      workspaceState,
    });

    return (
      <ProjectEditorScrollPane>
        <ProjectEditorContentCollectionSetupCard
          actionLabel={setupCopy.actionLabel}
          canUpdateProject={canUpdateProject}
          description={setupCopy.description}
          icon={selectedCollectionIcon}
          onOpenMappingDialog={() => {
            onOpenMappedContentMappingDialog(selectedCollection);
          }}
          title={setupCopy.title}
        />
      </ProjectEditorScrollPane>
    );
  }

  if (isLoadingCollection && !hasCurrentCollectionSnapshot) {
    if (selectedCollection === "Posts") {
      return postContentView === "editor" ? (
        <ProjectEditorPostEditorSkeleton />
      ) : (
        <ProjectEditorPostsListSkeleton />
      );
    }

    return <ProjectEditorTablePageSkeleton />;
  }

  if (!isContentReady) {
    if (workspaceState === "mapping_draft" && selectedCollection === "Posts") {
      return (
        <ProjectEditorScrollPane>
          <ProjectEditorPostsMappingDraftEntry
            canUpdateProject={canUpdateProject}
            onOpenMappingDialog={() => {
              onOpenMappedContentMappingDialog("Posts");
            }}
          />
        </ProjectEditorScrollPane>
      );
    }

    const notReadyCopy = getProjectEditorWorkspaceNotReadyCopy(workspaceState);

    return (
      <ProjectEditorStateCard
        description={loadingMessage ?? notReadyCopy.description}
        icon={selectedCollectionIcon}
        title={notReadyCopy.title}
      />
    );
  }

  if (projectConnectionError) {
    return <ProjectEditorConnectionErrorState description={projectConnectionError} />;
  }

  if (selectedCollection === "Authors") {
    return authorsPage;
  }

  if (selectedCollection === "Media") {
    return mediaPage;
  }

  if (selectedCollection === "Files") {
    return filesPage;
  }

  if (isPostsCollection) {
    if (shouldShowPostRouteLoadingState) {
      return <ProjectEditorPostEditorSkeleton />;
    }

    if (postContentView === "editor" && selectedPostLoadError) {
      return <ProjectEditorPostLoadErrorState description={selectedPostLoadError} />;
    }

    if (postContentView === "list") {
      return postsCollectionPage;
    }

    if (!selectedPost) {
      return <ProjectEditorPostEditorSkeleton />;
    }

    if (isCurrentPostBlocked) {
      return postBlockedState;
    }

    return postEditorBody;
  }

  if (selectedCollection === "Categories") {
    return categoriesPage;
  }

  if (selectedCollection === "Tags") {
    return tagsPage;
  }

  if (!entries.length) {
    return (
      <ProjectEditorEmptyCollectionState
        collection={selectedCollection}
        icon={selectedCollectionIcon}
      />
    );
  }

  return (
    <ProjectEditorSidebarEntriesList
      entries={entries}
      pagination={sidebarEntriesPagination}
    />
  );
};

export const renderProjectEditorSidePanel = ({
  isContentReady,
  isPostsCollection,
  isSettingsView,
  postContentView,
  postSidePanel,
  selectedCollection,
  showSeoPanel,
  taxonomySidePanel,
}: ProjectEditorSidePanelInput) => {
  if (isSettingsView || !showSeoPanel || !isContentReady) {
    return null;
  }

  if (isPostsCollection) {
    return postContentView === "editor" ? postSidePanel : null;
  }

  if (selectedCollection === "Categories" || selectedCollection === "Tags") {
    return taxonomySidePanel;
  }

  return null;
};
