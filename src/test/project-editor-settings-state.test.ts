import { describe, expect, it } from "vitest";

import {
  getProjectEditorSettingsRedirectUrl,
  getProjectEditorSettingsSaveDraft,
  getProjectEditorSettingsState,
  runProjectEditorDeleteAction,
  runProjectEditorSettingsSaveAction,
} from "@/components/editor/project-editor/project-settings-state";

describe("project editor settings state", () => {
  it("normalizes draft project settings and detects changes", () => {
    const result = getProjectEditorSettingsState({
      currentProjectName: "Demo",
      currentProjectSlug: "demo",
      currentProjectWebsiteUrl: "https://example.com",
      deleteProjectConfirmation: "Demo",
      settingsNameDraft: "Demo Site",
      settingsSlugDraft: " Demo Site ",
      settingsWebsiteUrlDraft: "example.org",
    });

    expect(result.normalizedSettingsSlug).toBe("demo-site");
    expect(result.normalizedSettingsWebsiteUrl).toBe("https://example.org/");
    expect(result.hasProjectSettingsChanges).toBe(true);
    expect(result.nextProjectUrl).toBe("/projects/demo-site");
    expect(result.isDeleteProjectConfirmationValid).toBe(true);
  });

  it("keeps unchanged settings clean after normalization", () => {
    const result = getProjectEditorSettingsState({
      currentProjectName: "Demo",
      currentProjectSlug: "demo",
      currentProjectWebsiteUrl: "https://example.com",
      deleteProjectConfirmation: "demo",
      settingsNameDraft: " Demo ",
      settingsSlugDraft: "demo",
      settingsWebsiteUrlDraft: "example.com",
    });

    expect(result.hasProjectSettingsChanges).toBe(false);
    expect(result.isDeleteProjectConfirmationValid).toBe(false);
  });

  it("builds a normalized project settings save draft", () => {
    expect(
      getProjectEditorSettingsSaveDraft({
        settingsNameDraft: " Demo Site ",
        settingsSlugDraft: " Demo Site ",
        settingsWebsiteUrlDraft: "example.com",
      }),
    ).toEqual({
      request: {
        name: "Demo Site",
        slug: "demo-site",
        websiteUrl: "https://example.com/",
      },
      validationError: null,
    });
  });

  it("returns validation errors before project settings mutation work starts", () => {
    expect(
      getProjectEditorSettingsSaveDraft({
        settingsNameDraft: "",
        settingsSlugDraft: "demo",
        settingsWebsiteUrlDraft: "",
      }).validationError,
    ).toBe("Enter a project name first.");
    expect(
      getProjectEditorSettingsSaveDraft({
        settingsNameDraft: "Demo",
        settingsSlugDraft: "",
        settingsWebsiteUrlDraft: "",
      }).validationError,
    ).toBe("Enter a project address first.");
    expect(
      getProjectEditorSettingsSaveDraft({
        settingsNameDraft: "Demo",
        settingsSlugDraft: "demo",
        settingsWebsiteUrlDraft: "not a url",
      }).validationError,
    ).toBe("Enter a valid website URL, like https://example.com.");
  });

  it("keeps project settings route replacement decisions out of the editor shell", () => {
    const buildProjectUrl = (options: {
      page?: number;
      postId?: string;
      projectSlug?: string;
      section?: string;
    }) => JSON.stringify(options);

    expect(
      getProjectEditorSettingsRedirectUrl({
        buildProjectUrl,
        currentPostsListPage: 3,
        isPostRoute: false,
        nextProjectSlug: "next",
        previousProjectSlug: "previous",
        selectedCollection: "Posts",
        selectedPostId: null,
        selectedSidebarItem: "Settings",
      }),
    ).toBe(JSON.stringify({ projectSlug: "next", section: "Settings" }));
    expect(
      getProjectEditorSettingsRedirectUrl({
        buildProjectUrl,
        currentPostsListPage: 3,
        isPostRoute: true,
        nextProjectSlug: "next",
        previousProjectSlug: "previous",
        selectedCollection: "Posts",
        selectedPostId: "post-1",
        selectedSidebarItem: "Posts",
      }),
    ).toBe(JSON.stringify({ projectSlug: "next", postId: "post-1" }));
    expect(
      getProjectEditorSettingsRedirectUrl({
        buildProjectUrl,
        currentPostsListPage: 3,
        isPostRoute: false,
        nextProjectSlug: "previous",
        previousProjectSlug: "previous",
        selectedCollection: "Posts",
        selectedPostId: null,
        selectedSidebarItem: "Posts",
      }),
    ).toBeNull();
  });

  it("blocks project settings saves before mutation work when permissions or drafts are invalid", async () => {
    const events: string[] = [];

    await runProjectEditorSettingsSaveAction({
      buildProjectUrl: () => "/projects/demo/settings",
      canUpdateProject: false,
      currentPostsListPage: 1,
      currentProjectSlug: "demo",
      getErrorMessage: (error, fallbackMessage) =>
        error instanceof Error ? error.message : fallbackMessage,
      isPostRoute: false,
      projectId: "project-1",
      replaceProjectRoute: () => events.push("redirect"),
      selectedCollection: "Posts",
      selectedPostId: null,
      selectedSidebarItem: "Settings",
      setIsSavingProjectSettings: (saving) => events.push(`saving:${saving}`),
      settingsNameDraft: "Demo",
      settingsSlugDraft: "demo",
      settingsWebsiteUrlDraft: "",
      syncProjectSettings: () => events.push("sync"),
      toastError: (message) => events.push(`error:${message}`),
      toastSuccess: (message) => events.push(`success:${message}`),
      updateProjectSettings: async () => {
        events.push("mutation");
        return { project: { id: "project-1", name: "Demo", slug: "demo", websiteUrl: null } };
      },
    });

    await runProjectEditorSettingsSaveAction({
      buildProjectUrl: () => "/projects/demo/settings",
      canUpdateProject: true,
      currentPostsListPage: 1,
      currentProjectSlug: "demo",
      getErrorMessage: (error, fallbackMessage) =>
        error instanceof Error ? error.message : fallbackMessage,
      isPostRoute: false,
      projectId: "project-1",
      replaceProjectRoute: () => events.push("redirect"),
      selectedCollection: "Posts",
      selectedPostId: null,
      selectedSidebarItem: "Settings",
      setIsSavingProjectSettings: (saving) => events.push(`saving:${saving}`),
      settingsNameDraft: "",
      settingsSlugDraft: "demo",
      settingsWebsiteUrlDraft: "",
      syncProjectSettings: () => events.push("sync"),
      toastError: (message) => events.push(`error:${message}`),
      toastSuccess: (message) => events.push(`success:${message}`),
      updateProjectSettings: async () => {
        events.push("mutation");
        return { project: { id: "project-1", name: "Demo", slug: "demo", websiteUrl: null } };
      },
    });

    expect(events).toEqual([
      "error:You do not have permission to update this project.",
      "error:Enter a project name first.",
    ]);
  });

  it("runs project settings mutation orchestration outside the editor shell", async () => {
    const events: string[] = [];

    const result = await runProjectEditorSettingsSaveAction({
      buildProjectUrl: (options) => JSON.stringify(options),
      canUpdateProject: true,
      currentPostsListPage: 2,
      currentProjectSlug: "previous",
      getErrorMessage: (error, fallbackMessage) =>
        error instanceof Error ? error.message : fallbackMessage,
      isPostRoute: false,
      projectId: "project-1",
      replaceProjectRoute: (url) => events.push(`redirect:${url}`),
      selectedCollection: "Posts",
      selectedPostId: null,
      selectedSidebarItem: "Settings",
      setIsSavingProjectSettings: (saving) => events.push(`saving:${saving}`),
      settingsNameDraft: " Next Project ",
      settingsSlugDraft: "Next Project",
      settingsWebsiteUrlDraft: "example.com",
      syncProjectSettings: (project) =>
        events.push(`sync:${project.name}:${project.slug}:${project.websiteUrl ?? ""}`),
      toastError: (message) => events.push(`error:${message}`),
      toastSuccess: (message) => events.push(`success:${message}`),
      updateProjectSettings: async (request) => {
        events.push(
          `mutation:${request.currentSlug}:${request.name}:${request.slug}:${request.websiteUrl}`,
        );
        return {
          project: {
            id: request.projectId,
            name: request.name,
            slug: request.slug,
            websiteUrl: request.websiteUrl,
          },
        };
      },
    });

    expect(result).toEqual({
      redirectUrl: JSON.stringify({ projectSlug: "next-project", section: "Settings" }),
      status: "saved",
    });
    expect(events).toEqual([
      "saving:true",
      "mutation:previous:Next Project:next-project:https://example.com/",
      "sync:Next Project:next-project:https://example.com/",
      `redirect:${JSON.stringify({ projectSlug: "next-project", section: "Settings" })}`,
      "success:Project settings saved.",
      "saving:false",
    ]);
  });

  it("runs project delete mutation orchestration outside the editor shell", async () => {
    const events: string[] = [];

    await runProjectEditorDeleteAction({
      canDeleteProject: false,
      deleteProject: async () => {
        events.push("mutation");
        return { success: true };
      },
      getErrorMessage: (error, fallbackMessage) =>
        error instanceof Error ? error.message : fallbackMessage,
      isDeleteProjectConfirmationValid: true,
      isDeletingProject: false,
      navigateAfterDelete: () => events.push("navigate"),
      projectId: "project-1",
      resetDeleteProjectConfirmation: () => events.push("reset-confirmation"),
      setExternalPageLoading: (loading) => events.push(`external-loading:${loading}`),
      setIsDeletingProject: (deleting) => events.push(`deleting:${deleting}`),
      setShowDeleteProjectDialog: (open) => events.push(`dialog:${open}`),
      toastError: (message) => events.push(`error:${message}`),
      toastSuccess: (message) => events.push(`success:${message}`),
    });

    await runProjectEditorDeleteAction({
      canDeleteProject: true,
      deleteProject: async () => {
        events.push("mutation");
        return { success: true };
      },
      getErrorMessage: (error, fallbackMessage) =>
        error instanceof Error ? error.message : fallbackMessage,
      isDeleteProjectConfirmationValid: false,
      isDeletingProject: false,
      navigateAfterDelete: () => events.push("navigate"),
      projectId: "project-1",
      resetDeleteProjectConfirmation: () => events.push("reset-confirmation"),
      setExternalPageLoading: (loading) => events.push(`external-loading:${loading}`),
      setIsDeletingProject: (deleting) => events.push(`deleting:${deleting}`),
      setShowDeleteProjectDialog: (open) => events.push(`dialog:${open}`),
      toastError: (message) => events.push(`error:${message}`),
      toastSuccess: (message) => events.push(`success:${message}`),
    });

    await runProjectEditorDeleteAction({
      canDeleteProject: true,
      deleteProject: async ({ projectId }) => {
        events.push(`mutation:${projectId}`);
        return { success: true };
      },
      getErrorMessage: (error, fallbackMessage) =>
        error instanceof Error ? error.message : fallbackMessage,
      isDeleteProjectConfirmationValid: true,
      isDeletingProject: false,
      navigateAfterDelete: () => events.push("navigate"),
      projectId: "project-1",
      resetDeleteProjectConfirmation: () => events.push("reset-confirmation"),
      setExternalPageLoading: (loading) => events.push(`external-loading:${loading}`),
      setIsDeletingProject: (deleting) => events.push(`deleting:${deleting}`),
      setShowDeleteProjectDialog: (open) => events.push(`dialog:${open}`),
      toastError: (message) => events.push(`error:${message}`),
      toastSuccess: (message) => events.push(`success:${message}`),
    });

    expect(events).toEqual([
      "error:You do not have permission to delete this project.",
      "error:Enter the project name exactly to confirm deletion.",
      "deleting:true",
      "mutation:project-1",
      "reset-confirmation",
      "dialog:false",
      "external-loading:true",
      "navigate",
      "success:Project deleted.",
      "deleting:false",
    ]);
  });
});
