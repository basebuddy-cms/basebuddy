import type { LucideIcon } from "lucide-react";

import type { ProjectNavigationSidebarSettingsItem } from "@/components/editor/project-navigation-sidebar";

import type { CollectionLabel, SettingsTabKey, SidebarItem } from "./types";
import type { ProjectEditorCollectionAvailability } from "./utils";
import { getEditorPathSegment, getNormalizedSettingsTab, getSettingsTabLabel } from "./utils";

export type ProjectEditorSidebarCollectionSourceItem = {
  icon: LucideIcon;
  label: CollectionLabel;
  status: Exclude<ProjectEditorCollectionAvailability, "hidden">;
};

export type BuildProjectEditorUrlOptions = {
  page?: number | null;
  postId?: string | null;
  projectSlug?: string;
  section?: SidebarItem;
  settingsTab?: SettingsTabKey | null;
};

type BuildProjectEditorUrlParams = {
  activeSettingsTab: SettingsTabKey;
  canUpdateProject: boolean;
  currentProjectSlug: string;
  options?: BuildProjectEditorUrlOptions;
};

type BuildProjectEditorUrlFromStateParams = {
  activeSettingsTab: SettingsTabKey;
  canUpdateProject: boolean;
  currentPostsListPage: number;
  currentProjectSlug: string;
  postContentView: "list" | "editor";
  selectedCollection: CollectionLabel;
  selectedPostId: string | null;
  selectedSidebarItem: SidebarItem;
};

type CreateProjectSettingsSidebarItemsParams = {
  activeSettingsTab: SettingsTabKey;
  buildSettingsHref: (tab: SettingsTabKey) => string;
  canUpdateProject: boolean;
  onOpenSettings: (tab: SettingsTabKey) => void;
};

export const getProjectSettingsProceedLabel = (tab: SettingsTabKey) =>
  tab === "general" ? "Discard and Open Settings" : `Discard and Open ${getSettingsTabLabel(tab)}`;

export const shouldFallbackPendingPostEditorToList = ({
  postContentView,
  routePostId,
  selectedCollection,
  selectedPostId,
  selectedPostResolved,
}: {
  postContentView: "list" | "editor";
  routePostId: string | null;
  selectedCollection: CollectionLabel;
  selectedPostId: string | null;
  selectedPostResolved: boolean;
}) =>
  selectedCollection === "Posts" &&
  postContentView === "editor" &&
  !routePostId &&
  !selectedPostResolved &&
  !selectedPostId;

export const buildProjectEditorUrl = ({
  activeSettingsTab,
  canUpdateProject,
  currentProjectSlug,
  options,
}: BuildProjectEditorUrlParams) => {
  const nextSlug = options?.projectSlug ?? currentProjectSlug;
  const nextPage = Math.max(1, options?.page ?? 1);
  const nextPostId = options?.postId ?? null;

  if (nextPostId) {
    return `/projects/${nextSlug}/posts/${nextPostId}`;
  }

  const nextSection = options?.section ?? "Posts";

  if (nextSection === "Posts") {
    return nextPage > 1 ? `/projects/${nextSlug}/posts/page/${nextPage}` : `/projects/${nextSlug}/posts`;
  }

  if (nextSection === "Settings") {
    const nextSettingsTab = getNormalizedSettingsTab({
      canUpdateProject,
      value: options?.settingsTab ?? activeSettingsTab,
    });

    return `/projects/${nextSlug}/settings?tab=${nextSettingsTab}`;
  }

  return `/projects/${nextSlug}/${getEditorPathSegment(nextSection)}`;
};

export const buildProjectEditorUrlFromState = ({
  activeSettingsTab,
  canUpdateProject,
  currentPostsListPage,
  currentProjectSlug,
  postContentView,
  selectedCollection,
  selectedPostId,
  selectedSidebarItem,
}: BuildProjectEditorUrlFromStateParams) => {
  if (selectedSidebarItem === "Settings") {
    return buildProjectEditorUrl({
      activeSettingsTab,
      canUpdateProject,
      currentProjectSlug,
      options: {
        section: "Settings",
        settingsTab: activeSettingsTab,
      },
    });
  }

  if (selectedCollection === "Posts" && postContentView === "editor" && selectedPostId) {
    return buildProjectEditorUrl({
      activeSettingsTab,
      canUpdateProject,
      currentProjectSlug,
      options: {
        postId: selectedPostId,
      },
    });
  }

  return buildProjectEditorUrl({
    activeSettingsTab,
    canUpdateProject,
    currentProjectSlug,
    options: {
      page: selectedCollection === "Posts" ? currentPostsListPage : 1,
      section: selectedCollection,
    },
  });
};

export const createProjectSettingsSidebarItems = ({
  activeSettingsTab,
  buildSettingsHref,
  canUpdateProject,
  onOpenSettings,
}: CreateProjectSettingsSidebarItemsParams): ProjectNavigationSidebarSettingsItem[] => [
  {
    href: buildSettingsHref("general"),
    isActive: activeSettingsTab === "general",
    label: "General",
    onSelect: () => onOpenSettings("general"),
  },
  ...(canUpdateProject
    ? [
        {
          href: buildSettingsHref("members"),
          isActive: activeSettingsTab === "members",
          label: "Members",
          onSelect: () => onOpenSettings("members"),
        },
        {
          href: buildSettingsHref("invite-members"),
          isActive: activeSettingsTab === "invite-members",
          label: "Invite Members",
          onSelect: () => onOpenSettings("invite-members"),
        },
        {
          href: buildSettingsHref("permissions"),
          isActive: activeSettingsTab === "permissions",
          label: "Permissions",
          onSelect: () => onOpenSettings("permissions"),
        },
        {
          href: buildSettingsHref("sidebar-fields"),
          isActive: activeSettingsTab === "sidebar-fields",
          label: "Sidebar Fields",
          onSelect: () => onOpenSettings("sidebar-fields"),
        },
      ]
    : []),
  ...(canUpdateProject
    ? [
        {
          href: buildSettingsHref("mapping"),
          isActive: activeSettingsTab === "mapping",
          label: getSettingsTabLabel("mapping"),
          onSelect: () => onOpenSettings("mapping"),
        },
      ]
    : []),
];
