"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";

import type {
  ProjectNavigationSidebarCollectionItem,
  ProjectNavigationSidebarSettingsItem,
} from "@/components/editor/project-navigation-sidebar";

import {
  buildProjectEditorUrl,
  buildProjectEditorUrlFromState,
  createProjectSettingsSidebarItems,
  getProjectSettingsProceedLabel,
  type BuildProjectEditorUrlOptions,
  type ProjectEditorSidebarCollectionSourceItem,
} from "./navigation";
import type { CollectionLabel, PostSidePanelView, SettingsTabKey, SidebarItem } from "./types";
import { getNormalizedSettingsTab } from "./utils";

type RequestUnsavedChangesConfirmation = (
  action: () => void | Promise<void>,
  proceedLabel?: string,
  onCancel?: () => void,
) => void;

type UseProjectEditorNavigationParams = {
  activeSettingsTab: SettingsTabKey;
  canUpdateProject: boolean;
  currentPostsListPage: number;
  currentProjectSlug: string;
  hasRoutePostInMemory: boolean;
  isPostRoute: boolean;
  isSelectedCollectionVisible: boolean;
  isSettingsView: boolean;
  collectionPages: Record<CollectionLabel, number>;
  currentRouteUrl: string;
  externalPageLoading: boolean;
  pathname: string;
  postContentView: "list" | "editor";
  requestUnsavedChangesConfirmation: RequestUnsavedChangesConfirmation;
  resolvedWorkspace: boolean;
  routePostId: string | null;
  routePostsPage: number | null;
  routeSection: SidebarItem;
  routeSettingsTab: string | null;
  selectedCollection: CollectionLabel;
  selectedPostId: string | null;
  selectedSidebarItem: SidebarItem;
  setActiveSettingsTab: Dispatch<SetStateAction<SettingsTabKey>>;
  setCollectionPages: Dispatch<SetStateAction<Record<CollectionLabel, number>>>;
  setLoadingSelectedPost: Dispatch<SetStateAction<boolean>>;
  setPostContentView: Dispatch<SetStateAction<"list" | "editor">>;
  setPostSidePanelView: Dispatch<SetStateAction<PostSidePanelView>>;
  setSelectedCollection: Dispatch<SetStateAction<CollectionLabel>>;
  setSelectedPostId: Dispatch<SetStateAction<string | null>>;
  setSelectedPostLoadError: Dispatch<SetStateAction<string | null>>;
  setSelectedSidebarItem: Dispatch<SetStateAction<SidebarItem>>;
  setShowSeoPanel: Dispatch<SetStateAction<boolean>>;
  shouldForcePostsRouteSection: boolean;
  sidebarCollectionItems: ProjectEditorSidebarCollectionSourceItem[];
  collectionCount: (label: CollectionLabel) => number | null;
  collectionCountIsExact?: (label: CollectionLabel) => boolean;
  navigatePush: (url: string) => void;
  navigateReplace: (url: string) => void;
  prefetchCollection?: (collection: CollectionLabel) => void;
  prefetchSettings?: (tab: SettingsTabKey) => void;
};

type UseProjectEditorNavigationResult = {
  buildProjectUrl: (options?: BuildProjectEditorUrlOptions) => string;
  openProjectSettings: (tab?: SettingsTabKey) => void;
  projectSettingsHref: string;
  projectSettingsSidebarItems: ProjectNavigationSidebarSettingsItem[];
  projectSidebarCollectionItems: ProjectNavigationSidebarCollectionItem[];
};

export function useProjectEditorNavigation({
  activeSettingsTab,
  canUpdateProject,
  currentPostsListPage,
  currentProjectSlug,
  hasRoutePostInMemory,
  isPostRoute,
  isSelectedCollectionVisible,
  isSettingsView,
  collectionPages,
  currentRouteUrl,
  pathname,
  externalPageLoading,
  postContentView,
  requestUnsavedChangesConfirmation,
  resolvedWorkspace,
  routePostId,
  routePostsPage,
  routeSection,
  routeSettingsTab,
  selectedCollection,
  selectedPostId,
  selectedSidebarItem,
  setActiveSettingsTab,
  setCollectionPages,
  setLoadingSelectedPost,
  setPostContentView,
  setPostSidePanelView,
  setSelectedCollection,
  setSelectedPostId,
  setSelectedPostLoadError,
  setSelectedSidebarItem,
  setShowSeoPanel,
  shouldForcePostsRouteSection,
  sidebarCollectionItems,
  collectionCount,
  collectionCountIsExact,
  navigatePush,
  navigateReplace,
  prefetchCollection,
  prefetchSettings,
}: UseProjectEditorNavigationParams): UseProjectEditorNavigationResult {
  const normalizedRouteSettingsTab = useMemo(
    () =>
      getNormalizedSettingsTab({
        canUpdateProject,
        value: routeSettingsTab,
      }),
    [canUpdateProject, routeSettingsTab],
  );

  const buildProjectUrl = useCallback(
    (options?: BuildProjectEditorUrlOptions) =>
      buildProjectEditorUrl({
        activeSettingsTab,
        canUpdateProject,
        currentProjectSlug,
        options,
      }),
    [activeSettingsTab, canUpdateProject, currentProjectSlug],
  );

  useEffect(() => {
    setActiveSettingsTab((currentTab) =>
      currentTab === normalizedRouteSettingsTab ? currentTab : normalizedRouteSettingsTab,
    );
  }, [normalizedRouteSettingsTab, setActiveSettingsTab]);

  useEffect(() => {
    if (routeSection !== "Settings") {
      return;
    }

    const currentSettingsTab = typeof routeSettingsTab === "string" ? routeSettingsTab.trim().toLowerCase() : "";
    const nextUrl = buildProjectUrl({ section: "Settings", settingsTab: normalizedRouteSettingsTab });

    if (currentSettingsTab !== normalizedRouteSettingsTab && nextUrl !== currentRouteUrl) {
      navigateReplace(nextUrl);
    }
  }, [buildProjectUrl, currentRouteUrl, navigateReplace, normalizedRouteSettingsTab, routeSection, routeSettingsTab]);

  useLayoutEffect(() => {
    const nextSidebarItem = shouldForcePostsRouteSection ? "Posts" : routeSection;
    const nextCollection = nextSidebarItem === "Settings" ? "Posts" : nextSidebarItem;

    setSelectedSidebarItem(nextSidebarItem);
    setSelectedCollection(nextCollection);
    setSelectedPostId(routePostId);
    setPostContentView(routePostId ? "editor" : "list");
    setPostSidePanelView("details");
    setShowSeoPanel(Boolean(routePostId) || nextCollection === "Categories" || nextCollection === "Tags");
    setSelectedPostLoadError(null);
    setLoadingSelectedPost(Boolean(routePostId) && !hasRoutePostInMemory);

    if (!routePostId && nextCollection === "Posts") {
      const nextPostsPage = routePostsPage ?? 1;

      setCollectionPages((currentPages) =>
        currentPages.Posts === nextPostsPage
          ? currentPages
          : {
              ...currentPages,
              Posts: nextPostsPage,
            },
      );
    }
  }, [
    hasRoutePostInMemory,
    routePostId,
    routePostsPage,
    routeSection,
    setCollectionPages,
    setLoadingSelectedPost,
    setPostContentView,
    setPostSidePanelView,
    setSelectedCollection,
    setSelectedPostId,
    setSelectedPostLoadError,
    setSelectedSidebarItem,
    setShowSeoPanel,
    shouldForcePostsRouteSection,
  ]);

  useEffect(() => {
    if (!shouldForcePostsRouteSection) {
      return;
    }

    const nextUrl = buildProjectUrl({ page: currentPostsListPage, section: "Posts" });

    if (nextUrl !== pathname) {
      navigateReplace(nextUrl);
    }
  }, [buildProjectUrl, currentPostsListPage, navigateReplace, pathname, shouldForcePostsRouteSection]);

  useLayoutEffect(() => {
    if (!resolvedWorkspace || isSettingsView || selectedCollection === "Posts") {
      return;
    }

    if (isSelectedCollectionVisible) {
      return;
    }

    const nextUrl =
      currentPostsListPage > 1
        ? `/projects/${currentProjectSlug}/posts/page/${currentPostsListPage}`
        : `/projects/${currentProjectSlug}/posts`;

    setSelectedSidebarItem("Posts");
    setSelectedCollection("Posts");
    setSelectedPostId(null);
    setPostContentView("list");
    setPostSidePanelView("details");
    setShowSeoPanel(false);

    if (nextUrl !== pathname || isPostRoute) {
      navigateReplace(nextUrl);
    }
  }, [
    currentPostsListPage,
    currentProjectSlug,
    isPostRoute,
    isSelectedCollectionVisible,
    isSettingsView,
    navigateReplace,
    pathname,
    resolvedWorkspace,
    selectedCollection,
    setPostContentView,
    setPostSidePanelView,
    setSelectedCollection,
    setSelectedPostId,
    setSelectedSidebarItem,
    setShowSeoPanel,
  ]);

  const selectedStateUrl = useMemo(
    () =>
      buildProjectEditorUrlFromState({
        activeSettingsTab,
        canUpdateProject,
        currentPostsListPage,
        currentProjectSlug,
        postContentView,
        selectedCollection,
        selectedPostId,
        selectedSidebarItem,
      }),
    [
      activeSettingsTab,
      canUpdateProject,
      currentPostsListPage,
      currentProjectSlug,
      postContentView,
      selectedCollection,
      selectedPostId,
      selectedSidebarItem,
    ],
  );

  useEffect(() => {
    if (externalPageLoading || shouldForcePostsRouteSection) {
      return;
    }

    // Wait for the settings tab state to catch up with the current `?tab=` search param
    // before we normalize the URL from local navigation state.
    if (routeSection === "Settings" && normalizedRouteSettingsTab !== activeSettingsTab) {
      return;
    }

    if (!isSettingsView && selectedCollection !== "Posts" && !isSelectedCollectionVisible) {
      return;
    }

    if (selectedStateUrl !== currentRouteUrl) {
      navigateReplace(selectedStateUrl);
    }
  }, [
    activeSettingsTab,
    currentRouteUrl,
    externalPageLoading,
    isSelectedCollectionVisible,
    isSettingsView,
    navigateReplace,
    normalizedRouteSettingsTab,
    routeSection,
    selectedCollection,
    selectedStateUrl,
    shouldForcePostsRouteSection,
  ]);

  const applySidebarNavigationState = useCallback(
    (sidebarItem: SidebarItem, options?: { page?: number }) => {
      const nextCollection = sidebarItem === "Settings" ? "Posts" : sidebarItem;
      const nextPostsPage = Math.max(1, options?.page ?? 1);

      setSelectedSidebarItem(sidebarItem);
      setSelectedCollection(nextCollection);
      setSelectedPostId(null);
      setPostContentView("list");
      setPostSidePanelView("details");
      setShowSeoPanel(nextCollection === "Categories" || nextCollection === "Tags");
      setSelectedPostLoadError(null);
      setLoadingSelectedPost(false);
      setCollectionPages((currentPages) => {
        const targetPage = sidebarItem === "Posts" ? nextPostsPage : 1;

        return currentPages[nextCollection] === targetPage
          ? currentPages
          : {
              ...currentPages,
              [nextCollection]: targetPage,
            };
      });
    },
    [
      setCollectionPages,
      setLoadingSelectedPost,
      setPostContentView,
      setPostSidePanelView,
      setSelectedCollection,
      setSelectedPostId,
      setSelectedPostLoadError,
      setSelectedSidebarItem,
      setShowSeoPanel,
    ],
  );

  const handleCollectionSelect = useCallback(
    (collection: CollectionLabel) => {
      prefetchCollection?.(collection);
      requestUnsavedChangesConfirmation(() => {
        const nextPage =
          collection === "Posts"
            ? currentPostsListPage
            : collection === "Authors" || collection === "Categories" || collection === "Tags"
              ? collectionPages[collection]
              : 1;
        const nextUrl = buildProjectUrl({
          page: nextPage,
          section: collection,
        });

        if (nextUrl !== pathname || isPostRoute) {
          applySidebarNavigationState(collection, {
            page: nextPage,
          });
          navigatePush(nextUrl);
        }
      }, `Discard and Open ${collection}`);
    },
    [
      applySidebarNavigationState,
      buildProjectUrl,
      collectionPages,
      currentPostsListPage,
      isPostRoute,
      navigatePush,
      pathname,
      prefetchCollection,
      requestUnsavedChangesConfirmation,
    ],
  );

  const openProjectSettings = useCallback(
    (tab: SettingsTabKey = "general") => {
      const nextSettingsTab = getNormalizedSettingsTab({
        canUpdateProject,
        value: tab,
      });

      prefetchSettings?.(nextSettingsTab);
      requestUnsavedChangesConfirmation(() => {
        const nextUrl = buildProjectUrl({ section: "Settings", settingsTab: nextSettingsTab });

        if (nextUrl !== pathname || isPostRoute) {
          applySidebarNavigationState("Settings");
          navigatePush(nextUrl);
        }
      }, getProjectSettingsProceedLabel(nextSettingsTab));
    },
    [
      applySidebarNavigationState,
      buildProjectUrl,
      canUpdateProject,
      isPostRoute,
      navigatePush,
      pathname,
      prefetchSettings,
      requestUnsavedChangesConfirmation,
    ],
  );

  const projectSettingsHref = useMemo(
    () => buildProjectUrl({ section: "Settings" }),
    [buildProjectUrl],
  );

  const projectSidebarCollectionItems = useMemo<ProjectNavigationSidebarCollectionItem[]>(
    () =>
      sidebarCollectionItems.map((item) => ({
        count: collectionCount(item.label),
        countIsExact: collectionCountIsExact?.(item.label) ?? true,
        href: buildProjectUrl({
          page: item.label === "Posts" ? currentPostsListPage : 1,
          section: item.label,
        }),
        icon: item.icon,
        isActive: selectedSidebarItem === item.label,
        label: item.label,
        onSelect: () => handleCollectionSelect(item.label),
        status: item.status,
      })),
    [buildProjectUrl, collectionCount, collectionCountIsExact, currentPostsListPage, handleCollectionSelect, selectedSidebarItem, sidebarCollectionItems],
  );

  const projectSettingsSidebarItems = useMemo(
    () =>
      createProjectSettingsSidebarItems({
        activeSettingsTab,
        buildSettingsHref: (tab) => buildProjectUrl({ section: "Settings", settingsTab: tab }),
        canUpdateProject,
        onOpenSettings: openProjectSettings,
      }),
    [activeSettingsTab, buildProjectUrl, canUpdateProject, openProjectSettings],
  );

  return {
    buildProjectUrl,
    openProjectSettings,
    projectSettingsHref,
    projectSettingsSidebarItems,
    projectSidebarCollectionItems,
  };
}
