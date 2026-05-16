import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Database } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/editor/navigation-link", () => ({
  NavigationLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button type="button">Toggle Sidebar</button>,
}));

import { ProjectEditorChrome } from "@/components/editor/project-editor/editor-chrome";

const createBaseProps = () => ({
  activeSectionLabel: "Posts",
  canArchiveSelectedPost: true,
  canDeleteSelectedPost: true,
  canPublishSelectedPost: true,
  canRestoreSelectedPostToDraft: true,
  canToggleSidePanel: false,
  children: <div>Body</div>,
  currentProjectName: "Demo",
  hasSelectedPostUnsavedChanges: true,
  isArchivedPost: false,
  isCurrentPostEditable: true,
  isPostsCollection: true,
  isPublishedPost: true,
  isDeletingSelectedPost: false,
  isPublishing: false,
  isSaving: false,
  isMacKeyboardPlatform: false,
  onArchivePost: vi.fn(),
  onDeletePost: vi.fn(),
  onKeyboardShortcutsOpenChange: vi.fn(),
  onNavigateProjects: vi.fn(),
  onOpenSidePanel: vi.fn(),
  onPublish: vi.fn(),
  onRestorePostToDraft: vi.fn(),
  onSavePost: vi.fn(),
  selectedCollection: "Posts" as const,
  showKeyboardShortcuts: false,
  showEditorToolbar: true,
  showSeoPanel: false,
  sidePanel: null,
  sidePanelToggleIcon: Database,
  supportsWorkflowActions: false,
  toolbarDisabled: false,
  toolbarGroups: [],
  topBarStatusLabel: null,
});

describe("ProjectEditorChrome", () => {
  it("shows a plain save action when adapter workflow actions are unavailable", () => {
    render(<ProjectEditorChrome {...createBaseProps()} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
  });

  it("shows workflow controls when adapter workflow actions are available", () => {
    render(
      <ProjectEditorChrome
        {...createBaseProps()}
        supportsWorkflowActions
      />,
    );

    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("lets editors request deletion for the open post", () => {
    const onDeletePost = vi.fn();

    render(
      <ProjectEditorChrome
        {...createBaseProps()}
        onDeletePost={onDeletePost}
        supportsWorkflowActions
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete post" }));

    expect(onDeletePost).toHaveBeenCalledTimes(1);
  });

  it("keeps editor selection when toolbar formatting buttons are pressed", () => {
    const run = vi.fn();

    render(
      <ProjectEditorChrome
        {...createBaseProps()}
        toolbarGroups={[
          [{
            icon: Database,
            label: "Link",
            run,
          }],
        ]}
      />,
    );

    const linkButton = screen.getByRole("button", { name: "Link" });
    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });

    expect(linkButton.dispatchEvent(mouseDownEvent)).toBe(false);

    fireEvent.click(linkButton);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("explains why save is disabled when there are no unsaved changes", () => {
    render(
      <ProjectEditorChrome
        {...createBaseProps()}
        hasSelectedPostUnsavedChanges={false}
        supportsWorkflowActions
      />,
    );

    expect(screen.getByRole("button", { name: "Update" })).toHaveAttribute(
      "title",
      "No unsaved changes to save.",
    );
  });

  it("explains why publish is disabled when the draft is not publishable yet", () => {
    render(
      <ProjectEditorChrome
        {...createBaseProps()}
        canPublishSelectedPost={false}
        isPublishedPost={false}
        supportsWorkflowActions
      />,
    );

    expect(screen.getByRole("button", { name: "Publish" })).toHaveAttribute(
      "title",
      "Draft posts need a title before they can be published.",
    );
  });
});
