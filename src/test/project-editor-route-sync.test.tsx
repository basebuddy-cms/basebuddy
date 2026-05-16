import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProjectEditorNavigation } from "@/components/editor/project-editor/use-project-editor-navigation";
import type {
  CollectionLabel,
  SettingsTabKey,
  SidebarItem,
} from "@/components/editor/project-editor/types";

type NavigationParams = Parameters<typeof useProjectEditorNavigation>[0];

const createCollectionPages = (): Record<CollectionLabel, number> => ({
  Authors: 1,
  Categories: 1,
  Files: 1,
  Media: 1,
  Posts: 1,
  Tags: 1,
});

const createParams = (overrides: Partial<NavigationParams> = {}): NavigationParams => ({
  activeSettingsTab: "general",
  canUpdateProject: true,
  collectionCount: () => null,
  collectionPages: createCollectionPages(),
  currentPostsListPage: 1,
  currentProjectSlug: "demo",
  currentRouteUrl: "/projects/demo/posts",
  externalPageLoading: false,
  hasRoutePostInMemory: false,
  isPostRoute: false,
  isSelectedCollectionVisible: true,
  isSettingsView: false,
  navigatePush: vi.fn(),
  navigateReplace: vi.fn(),
  pathname: "/projects/demo/posts",
  postContentView: "list",
  requestUnsavedChangesConfirmation: (action) => {
    void action();
  },
  resolvedWorkspace: true,
  routePostId: null,
  routePostsPage: null,
  routeSection: "Posts",
  routeSettingsTab: null,
  selectedCollection: "Posts",
  selectedPostId: null,
  selectedSidebarItem: "Posts",
  setActiveSettingsTab: vi.fn(),
  setCollectionPages: vi.fn(),
  setLoadingSelectedPost: vi.fn(),
  setPostContentView: vi.fn(),
  setPostSidePanelView: vi.fn(),
  setSelectedCollection: vi.fn(),
  setSelectedPostId: vi.fn(),
  setSelectedPostLoadError: vi.fn(),
  setSelectedSidebarItem: vi.fn(),
  setShowSeoPanel: vi.fn(),
  shouldForcePostsRouteSection: false,
  sidebarCollectionItems: [],
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project editor route sync", () => {
  it("repairs a stale settings URL when local state has already returned to the posts list", async () => {
    const navigateReplace = vi.fn();
    const initialParams = createParams({
      activeSettingsTab: "mapping" satisfies SettingsTabKey,
      currentRouteUrl: "/projects/demo/settings?tab=mapping",
      isSettingsView: true,
      navigateReplace,
      pathname: "/projects/demo/settings",
      routeSection: "Settings" satisfies SidebarItem,
      routeSettingsTab: "mapping",
      selectedSidebarItem: "Settings" satisfies SidebarItem,
    });

    const { rerender } = renderHook(({ params }) => useProjectEditorNavigation(params), {
      initialProps: {
        params: initialParams,
      },
    });

    navigateReplace.mockClear();

    rerender({
      params: {
        ...initialParams,
        isSettingsView: false,
        selectedSidebarItem: "Posts",
      },
    });

    await waitFor(() => {
      expect(navigateReplace).toHaveBeenCalledWith("/projects/demo/posts");
    });
  });

  it("repairs a stale post URL when local state has already returned to the posts list", async () => {
    const navigateReplace = vi.fn();
    const initialParams = createParams({
      currentPostsListPage: 3,
      currentRouteUrl: "/projects/demo/posts/post_123",
      isPostRoute: true,
      navigateReplace,
      pathname: "/projects/demo/posts/post_123",
      postContentView: "editor",
      routePostId: "post_123",
      routeSection: "Posts",
      selectedPostId: "post_123",
    });

    const { rerender } = renderHook(({ params }) => useProjectEditorNavigation(params), {
      initialProps: {
        params: initialParams,
      },
    });

    navigateReplace.mockClear();

    rerender({
      params: {
        ...initialParams,
        postContentView: "list",
        selectedPostId: null,
      },
    });

    await waitFor(() => {
      expect(navigateReplace).toHaveBeenCalledWith("/projects/demo/posts/page/3");
    });
  });
});
