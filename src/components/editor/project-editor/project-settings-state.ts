import {
  normalizeProjectSlug,
  normalizeProjectWebsiteUrl,
} from "@/lib/control-plane/utils";

import type { BuildProjectEditorUrlOptions } from "./navigation";
import type { CollectionLabel, SidebarItem } from "./types";

type ProjectEditorSettingsStateInput = {
  currentProjectName: string;
  currentProjectSlug: string;
  currentProjectWebsiteUrl: string;
  deleteProjectConfirmation: string;
  settingsNameDraft: string;
  settingsSlugDraft: string;
  settingsWebsiteUrlDraft: string;
};

type ProjectEditorSettingsSaveDraftInput = {
  settingsNameDraft: string;
  settingsSlugDraft: string;
  settingsWebsiteUrlDraft: string;
};

type ProjectEditorSettingsRedirectUrlInput = {
  buildProjectUrl: (options?: BuildProjectEditorUrlOptions) => string;
  currentPostsListPage: number;
  isPostRoute: boolean;
  nextProjectSlug: string;
  previousProjectSlug: string;
  selectedCollection: CollectionLabel;
  selectedPostId: string | null;
  selectedSidebarItem: SidebarItem;
};

type ProjectEditorSettingsProject = {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
};

type ProjectEditorSettingsUpdateRequest = {
  currentSlug: string;
  name: string;
  projectId: string;
  slug: string;
  websiteUrl: string | null;
};

type ProjectEditorSettingsSaveActionInput = ProjectEditorSettingsSaveDraftInput &
  Omit<ProjectEditorSettingsRedirectUrlInput, "nextProjectSlug" | "previousProjectSlug"> & {
    canUpdateProject: boolean;
    currentProjectSlug: string;
    getErrorMessage: (error: unknown, fallbackMessage: string) => string;
    projectId: string;
    replaceProjectRoute: (url: string) => void;
    setIsSavingProjectSettings: (saving: boolean) => void;
    syncProjectSettings: (project: ProjectEditorSettingsProject) => void;
    toastError: (message: string) => void;
    toastSuccess: (message: string) => void;
    updateProjectSettings: (
      request: ProjectEditorSettingsUpdateRequest,
    ) => Promise<{ error?: string; project?: ProjectEditorSettingsProject }>;
  };

type ProjectEditorDeleteActionInput = {
  canDeleteProject: boolean;
  deleteProject: (request: { projectId: string }) => Promise<{ error?: string; success?: boolean }>;
  getErrorMessage: (error: unknown, fallbackMessage: string) => string;
  isDeleteProjectConfirmationValid: boolean;
  isDeletingProject: boolean;
  navigateAfterDelete: () => void;
  projectId: string;
  resetDeleteProjectConfirmation: () => void;
  setExternalPageLoading: (loading: boolean) => void;
  setIsDeletingProject: (deleting: boolean) => void;
  setShowDeleteProjectDialog: (open: boolean) => void;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
};

export const getProjectEditorSettingsState = ({
  currentProjectName,
  currentProjectSlug,
  currentProjectWebsiteUrl,
  deleteProjectConfirmation,
  settingsNameDraft,
  settingsSlugDraft,
  settingsWebsiteUrlDraft,
}: ProjectEditorSettingsStateInput) => {
  const normalizedSettingsSlug = normalizeProjectSlug(settingsSlugDraft);
  const normalizedSettingsWebsiteUrl = normalizeProjectWebsiteUrl(settingsWebsiteUrlDraft) ?? "";

  return {
    hasProjectSettingsChanges:
      settingsNameDraft.trim() !== currentProjectName ||
      normalizedSettingsSlug !== currentProjectSlug ||
      normalizedSettingsWebsiteUrl !== (normalizeProjectWebsiteUrl(currentProjectWebsiteUrl) ?? ""),
    isDeleteProjectConfirmationValid: deleteProjectConfirmation.trim() === currentProjectName,
    nextProjectUrl: `/projects/${normalizedSettingsSlug || "project-slug"}`,
    normalizedSettingsSlug,
    normalizedSettingsWebsiteUrl,
  };
};

export const getProjectEditorSettingsSaveDraft = ({
  settingsNameDraft,
  settingsSlugDraft,
  settingsWebsiteUrlDraft,
}: ProjectEditorSettingsSaveDraftInput) => {
  const nextProjectName = settingsNameDraft.trim();
  const nextProjectSlug = normalizeProjectSlug(settingsSlugDraft);
  const nextProjectWebsiteUrl = normalizeProjectWebsiteUrl(settingsWebsiteUrlDraft);

  if (!nextProjectName) {
    return {
      request: null,
      validationError: "Enter a project name first.",
    };
  }

  if (!nextProjectSlug) {
    return {
      request: null,
      validationError: "Enter a project address first.",
    };
  }

  if (settingsWebsiteUrlDraft.trim() && !nextProjectWebsiteUrl) {
    return {
      request: null,
      validationError: "Enter a valid website URL, like https://example.com.",
    };
  }

  return {
    request: {
      name: nextProjectName,
      slug: nextProjectSlug,
      websiteUrl: nextProjectWebsiteUrl,
    },
    validationError: null,
  };
};

export const getProjectEditorSettingsRedirectUrl = ({
  buildProjectUrl,
  currentPostsListPage,
  isPostRoute,
  nextProjectSlug,
  previousProjectSlug,
  selectedCollection,
  selectedPostId,
  selectedSidebarItem,
}: ProjectEditorSettingsRedirectUrlInput) => {
  if (nextProjectSlug === previousProjectSlug) {
    return null;
  }

  if (selectedSidebarItem === "Settings") {
    return buildProjectUrl({ projectSlug: nextProjectSlug, section: "Settings" });
  }

  if (isPostRoute && selectedPostId) {
    return buildProjectUrl({ projectSlug: nextProjectSlug, postId: selectedPostId });
  }

  return buildProjectUrl({
    page: selectedCollection === "Posts" ? currentPostsListPage : 1,
    projectSlug: nextProjectSlug,
  });
};

export const runProjectEditorSettingsSaveAction = async ({
  buildProjectUrl,
  canUpdateProject,
  currentPostsListPage,
  currentProjectSlug,
  getErrorMessage,
  isPostRoute,
  projectId,
  replaceProjectRoute,
  selectedCollection,
  selectedPostId,
  selectedSidebarItem,
  setIsSavingProjectSettings,
  settingsNameDraft,
  settingsSlugDraft,
  settingsWebsiteUrlDraft,
  syncProjectSettings,
  toastError,
  toastSuccess,
  updateProjectSettings,
}: ProjectEditorSettingsSaveActionInput) => {
  if (!canUpdateProject) {
    toastError("You do not have permission to update this project.");
    return { redirectUrl: null, status: "blocked" as const };
  }

  const settingsSaveDraft = getProjectEditorSettingsSaveDraft({
    settingsNameDraft,
    settingsSlugDraft,
    settingsWebsiteUrlDraft,
  });

  if (!settingsSaveDraft.request) {
    toastError(settingsSaveDraft.validationError);
    return { redirectUrl: null, status: "invalid" as const };
  }

  setIsSavingProjectSettings(true);

  try {
    const previousProjectSlug = currentProjectSlug;
    const payload = await updateProjectSettings({
      currentSlug: previousProjectSlug,
      name: settingsSaveDraft.request.name,
      projectId,
      slug: settingsSaveDraft.request.slug,
      websiteUrl: settingsSaveDraft.request.websiteUrl,
    });

    if (!payload.project) {
      throw new Error(payload.error ?? "Could not update this project right now.");
    }

    syncProjectSettings(payload.project);

    const redirectUrl = getProjectEditorSettingsRedirectUrl({
      buildProjectUrl,
      currentPostsListPage,
      isPostRoute,
      nextProjectSlug: payload.project.slug,
      previousProjectSlug,
      selectedCollection,
      selectedPostId,
      selectedSidebarItem,
    });

    if (redirectUrl) {
      replaceProjectRoute(redirectUrl);
    }

    toastSuccess("Project settings saved.");

    return { redirectUrl, status: "saved" as const };
  } catch (error) {
    toastError(getErrorMessage(error, "Could not update this project right now."));
    return { redirectUrl: null, status: "error" as const };
  } finally {
    setIsSavingProjectSettings(false);
  }
};

export const runProjectEditorDeleteAction = async ({
  canDeleteProject,
  deleteProject,
  getErrorMessage,
  isDeleteProjectConfirmationValid,
  isDeletingProject,
  navigateAfterDelete,
  projectId,
  resetDeleteProjectConfirmation,
  setExternalPageLoading,
  setIsDeletingProject,
  setShowDeleteProjectDialog,
  toastError,
  toastSuccess,
}: ProjectEditorDeleteActionInput) => {
  if (!canDeleteProject || isDeletingProject) {
    if (!canDeleteProject) {
      toastError("You do not have permission to delete this project.");
    }

    return { status: "blocked" as const };
  }

  if (!isDeleteProjectConfirmationValid) {
    toastError("Enter the project name exactly to confirm deletion.");
    return { status: "invalid" as const };
  }

  setIsDeletingProject(true);

  try {
    const payload = await deleteProject({ projectId });

    if (!payload.success) {
      throw new Error(payload.error ?? "Could not delete this project right now.");
    }

    resetDeleteProjectConfirmation();
    setShowDeleteProjectDialog(false);
    setExternalPageLoading(true);
    navigateAfterDelete();
    toastSuccess("Project deleted.");

    return { status: "deleted" as const };
  } catch (error) {
    toastError(getErrorMessage(error, "Could not delete this project right now."));
    return { status: "error" as const };
  } finally {
    setIsDeletingProject(false);
  }
};
