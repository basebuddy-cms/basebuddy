import { describe, expect, it, vi } from "vitest";

import {
  buildProjectEditorUrl,
  shouldFallbackPendingPostEditorToList,
  createProjectSettingsSidebarItems,
  getProjectSettingsProceedLabel,
} from "@/components/editor/project-editor/navigation";
import {
  forgetProjectEditorCollectionSnapshots,
  getProjectEditorRouteState,
  getProjectEditorTopBarStatusLabel,
  rememberProjectEditorCollectionSnapshot,
  shouldShowUnresolvedPostsListSkeleton,
} from "@/components/editor/project-editor/utils";

describe("project editor navigation", () => {
  const buildSettingsHref = (
    tab: "general" | "members" | "invite-members" | "permissions" | "mapping" | "sidebar-fields",
  ) =>
    `/projects/demo/settings?tab=${tab}`;

  it("builds post list, post detail, and collection routes", () => {
    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
      }),
    ).toBe("/projects/demo/posts");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
        options: { page: 3 },
      }),
    ).toBe("/projects/demo/posts/page/3");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
        options: { postId: "post_123" },
      }),
    ).toBe("/projects/demo/posts/post_123");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
        options: { section: "Categories" },
      }),
    ).toBe("/projects/demo/categories");
  });

  it("normalizes settings routes to the allowed tab", () => {
    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "members",
        canUpdateProject: false,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "permissions" },
      }),
    ).toBe("/projects/demo/settings?tab=general");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "members",
        canUpdateProject: false,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "invite-members" as never },
      }),
    ).toBe("/projects/demo/settings?tab=general");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "mapping" as never },
      }),
    ).toBe("/projects/demo/settings?tab=mapping");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "mapping" as never },
      }),
    ).toBe("/projects/demo/settings?tab=mapping");
  });

  it("builds only the settings items allowed for the current project", () => {
    const onOpenSettings = vi.fn();

    expect(
      createProjectSettingsSidebarItems({
        activeSettingsTab: "general",
        buildSettingsHref,
        canUpdateProject: false,
        onOpenSettings,
      }).map((item) => item.label),
    ).toEqual(["General"]);

    expect(
      createProjectSettingsSidebarItems({
        activeSettingsTab: "general",
        buildSettingsHref,
        canUpdateProject: true,
        onOpenSettings,
      }).map((item) => item.label),
    ).toEqual(["General", "Members", "Invite Members", "Permissions", "Sidebar Fields", "Content Mapping"]);

    expect(
      createProjectSettingsSidebarItems({
        activeSettingsTab: "mapping",
        buildSettingsHref,
        canUpdateProject: true,
        onOpenSettings,
      }).map((item) => item.label),
    ).toEqual(["General", "Members", "Invite Members", "Permissions", "Sidebar Fields", "Content Mapping"]);
  });

  it("supports the invite-members settings tab for project managers", () => {
    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "invite-members" as never },
      }),
    ).toBe("/projects/demo/settings?tab=invite-members");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: false,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "invite-members" as never },
      }),
    ).toBe("/projects/demo/settings?tab=general");
  });

  it("supports the sidebar fields settings tab for project managers", () => {
    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: true,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "sidebar-fields" as never },
      }),
    ).toBe("/projects/demo/settings?tab=sidebar-fields");

    expect(
      buildProjectEditorUrl({
        activeSettingsTab: "general",
        canUpdateProject: false,
        currentProjectSlug: "demo",
        options: { section: "Settings", settingsTab: "sidebar-fields" as never },
      }),
    ).toBe("/projects/demo/settings?tab=general");
  });

  it("formats the unsaved-changes label for settings navigation", () => {
    expect(getProjectSettingsProceedLabel("general")).toBe("Discard and Open Settings");
    expect(getProjectSettingsProceedLabel("permissions")).toBe("Discard and Open Permissions");
    expect(getProjectSettingsProceedLabel("mapping")).toBe("Discard and Open Content Mapping");
  });

  it("keeps the editor open while a post-route transition is still in flight", () => {
    expect(
      shouldFallbackPendingPostEditorToList({
        postContentView: "editor",
        routePostId: null,
        selectedCollection: "Posts",
        selectedPostId: "post_123",
        selectedPostResolved: false,
      }),
    ).toBe(false);

    expect(
      shouldFallbackPendingPostEditorToList({
        postContentView: "editor",
        routePostId: null,
        selectedCollection: "Posts",
        selectedPostId: null,
        selectedPostResolved: false,
      }),
    ).toBe(true);
  });

  it("derives route state directly from project editor URLs", () => {
    expect(getProjectEditorRouteState("/projects/demo")).toEqual({
      routePostId: null,
      routePostsPage: null,
      routeSection: "Posts",
    });

    expect(getProjectEditorRouteState("/projects/demo/posts")).toEqual({
      routePostId: null,
      routePostsPage: null,
      routeSection: "Posts",
    });

    expect(getProjectEditorRouteState("/projects/demo/posts/post_123")).toEqual({
      routePostId: "post_123",
      routePostsPage: null,
      routeSection: "Posts",
    });

    expect(getProjectEditorRouteState("/projects/demo/posts/page/4")).toEqual({
      routePostId: null,
      routePostsPage: 4,
      routeSection: "Posts",
    });

    expect(getProjectEditorRouteState("/projects/demo/settings?tab=members")).toEqual({
      routePostId: null,
      routePostsPage: null,
      routeSection: "Settings",
    });
  });

  it("prefers explicit route-loading labels in the top bar", () => {
    expect(
      getProjectEditorTopBarStatusLabel({
        externalPageLoading: true,
        selectedSidebarItem: "Categories",
        showTopBarAutosaveStatus: true,
        showTopBarSpinner: true,
      }),
    ).toBe("Opening categories...");

    expect(
      getProjectEditorTopBarStatusLabel({
        externalPageLoading: true,
        selectedSidebarItem: "Settings",
        showTopBarAutosaveStatus: false,
        showTopBarSpinner: true,
      }),
    ).toBe("Opening project settings...");

    expect(
      getProjectEditorTopBarStatusLabel({
        externalPageLoading: false,
        selectedSidebarItem: "Posts",
        showTopBarAutosaveStatus: false,
        showTopBarSpinner: true,
      }),
    ).toBe("Checking if data is up to date.");
  });

  it("remembers resolved collection snapshots without dropping older sections", () => {
    const snapshotKeys = rememberProjectEditorCollectionSnapshot(
      ["content-runtime:demo:Categories:1:20"],
      "content-runtime:demo:Authors:2:20",
    );

    expect(snapshotKeys).toEqual([
      "content-runtime:demo:Categories:1:20",
      "content-runtime:demo:Authors:2:20",
    ]);

    expect(
      rememberProjectEditorCollectionSnapshot(
        snapshotKeys,
        "content-runtime:demo:Categories:1:20",
      ),
    ).toEqual(snapshotKeys);
  });

  it("forgets only the invalidated collection snapshots", () => {
    expect(
      forgetProjectEditorCollectionSnapshots({
        collection: "Categories",
        projectId: "demo",
        snapshotKeys: [
          "content-runtime:demo:Categories:1:20",
          "content-runtime:demo:Authors:2:20",
          "content-runtime:demo:Categories:3:20",
        ],
      }),
    ).toEqual(["content-runtime:demo:Authors:2:20"]);

    expect(
      forgetProjectEditorCollectionSnapshots({
        projectId: "demo",
        snapshotKeys: ["content-runtime:demo:Posts:1:10"],
      }),
    ).toEqual([]);
  });

  it("keeps the posts list in a loading state until the first query resolves", () => {
    expect(
      shouldShowUnresolvedPostsListSkeleton({
        hasResolvedCollectionSnapshot: false,
        postsPageDataReady: false,
        postsPageLoadFailed: false,
        shouldQueryPostsPage: true,
      }),
    ).toBe(true);

    expect(
      shouldShowUnresolvedPostsListSkeleton({
        hasResolvedCollectionSnapshot: true,
        postsPageDataReady: false,
        postsPageLoadFailed: false,
        shouldQueryPostsPage: true,
      }),
    ).toBe(false);

    expect(
      shouldShowUnresolvedPostsListSkeleton({
        hasResolvedCollectionSnapshot: false,
        postsPageDataReady: true,
        postsPageLoadFailed: false,
        shouldQueryPostsPage: true,
      }),
    ).toBe(false);
  });
});
