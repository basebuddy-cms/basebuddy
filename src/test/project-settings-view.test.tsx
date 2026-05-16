import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultContentPostSidebarConfig } from "@/lib/content-runtime/shared";

import { ProjectSettingsView } from "@/components/editor/project-editor/settings-view";

const createBaseProps = (
  overrides: Partial<React.ComponentProps<typeof ProjectSettingsView>> = {},
) => ({
  activeSettingsTab: "mapping" as const,
  canDeleteProject: true,
  canUpdateProject: true,
  contentRuntime: null,
  handleOpenSettingsMapping: vi.fn(),
  handlePostSidebarConfigResetToDefault: vi.fn(),
  handlePostSidebarConfigRestoreSaved: vi.fn(),
  handlePostSidebarConfigSave: vi.fn(),
  handleUnmapSettingsMapping: vi.fn(),
  handleProjectSettingsSave: vi.fn(),
  handleProjectSlugUnlock: vi.fn(),
  hasPostSidebarConfigChanges: false,
  hasProjectSettingsChanges: false,
  isDeletingProject: false,
  isProjectSlugLocked: true,
  isSavingPostSidebarConfig: false,
  isSavingProjectSettings: false,
  loadingSettingsMappingCollection: null,
  nextProjectUrl: "/projects/demo",
  normalizedSettingsSlug: "demo",
  postSidebarConfigDraft: createDefaultContentPostSidebarConfig(),
  projectId: "project-1",
  setIsProjectSlugLocked: vi.fn(),
  setPostSidebarConfigDraft: vi.fn(),
  setSettingsNameDraft: vi.fn(),
  setSettingsSlugDraft: vi.fn(),
  setSettingsWebsiteUrlDraft: vi.fn(),
  setShowDeleteProjectDialog: vi.fn(),
  settingsMappingError: null,
  settingsNameDraft: "Demo",
  settingsSlugDraft: "demo",
  settingsWebsiteUrlDraft: "",
  supportsPostRevisions: false,
  unmappingSettingsTarget: null,
  workspaceState: "ready" as const,
  ...overrides,
});

describe("ProjectSettingsView mapping tab", () => {
  it("uses self-host wording in the settings intro", () => {
    const props = createBaseProps({
      activeSettingsTab: "general",
    });

    render(<ProjectSettingsView {...props} />);

    expect(
      screen.getByText(
        "Manage workspace details, members, invitations, permissions, content mapping, and editor sidebar behavior.",
      ),
    ).toBeInTheDocument();
  });

  it("renders section-specific mapping actions for mapped content projects", () => {
    const props = createBaseProps();

    render(<ProjectSettingsView {...props} />);

    expect(screen.getByRole("button", { name: "Open Posts mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Authors mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Categories mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Tags mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Media mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Files mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove all mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Posts mapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Categories mapping" })).toBeInTheDocument();
  });

  it("opens the requested collection mapping from settings", () => {
    const props = createBaseProps();

    render(<ProjectSettingsView {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Tags mapping" }));

    expect(props.handleOpenSettingsMapping).toHaveBeenCalledWith("Tags");
  });

  it("confirms unmapping a single collection from settings", async () => {
    const props = createBaseProps({
      contentRuntime: {
        customFields: [],
        editorFields: [],
        fieldSpecs: [
          {
            allowedValues: null,
            contentFormat: null,
            editabilityState: "editable",
            fieldKey: "categories",
            label: "Categories",
            multiple: true,
            nullable: true,
            patchMode: "replace",
            readOnly: false,
            relationMode: "managed_multi",
            required: false,
            searchMode: "remote",
            semanticRole: "categories",
            uiControl: "multi_select",
            valueKind: "relation_id_or_key",
            visible: true,
          },
        ],
        filesStorage: null,
        mediaStorage: null,
      },
    });

    render(<ProjectSettingsView {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Categories mapping" }));

    expect(screen.getByText("Remove Categories mapping?")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove mapping" }));
    });

    await waitFor(() => {
      expect(props.handleUnmapSettingsMapping).toHaveBeenCalledWith("Categories");
    });
  });

  it("confirms unmapping all mapping sections from settings", async () => {
    const props = createBaseProps();

    render(<ProjectSettingsView {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove all mapping" }));

    expect(screen.getByText("Remove all content mapping?")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove mapping" }));
    });

    await waitFor(() => {
      expect(props.handleUnmapSettingsMapping).toHaveBeenCalledWith("all");
    });
  });
});
