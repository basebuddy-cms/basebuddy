import React, { useState, type ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorDialogs } from "@/components/editor/project-editor/dialogs";

const MappingDraftProbe = () => {
  const [value, setValue] = useState("draft");

  return (
    <div>
      <span data-testid="mapping-draft-value">{value}</span>
      <button type="button" onClick={() => setValue("updated")}>
        Update draft
      </button>
    </div>
  );
};

const createProps = (
  overrides: Partial<ComponentProps<typeof ProjectEditorDialogs>> = {},
): ComponentProps<typeof ProjectEditorDialogs> => ({
  acquiringPostEditSession: false,
  canEditCurrentPost: false,
  canForcePostTakeover: false,
  clearPendingUnsavedChangesConfirmation: vi.fn(),
  currentProjectName: "Demo Project",
  deleteProjectConfirmation: "",
  getEditingSessionLabel: () => "editing",
  handleDeleteProject: vi.fn(async () => {}),
  handleDeleteCollectionEntries: vi.fn(async () => {}),
  handleDeletePosts: vi.fn(async () => {}),
  handleDiscardLostPostDraft: vi.fn(async () => {}),
  handleDiscardStoredDraft: vi.fn(async () => {}),
  handleGoBackFromTakeover: vi.fn(),
  handleLostPostAccessAcknowledge: vi.fn(),
  onConfirmSaveMapping: vi.fn(),
  handleProceedWithoutSaving: vi.fn(async () => {}),
  handleProjectSlugUnlockProceed: vi.fn(),
  handleRestoreLostPostDraft: vi.fn(),
  handleRestorePostRevision: vi.fn(async () => {}),
  handleRestoreStoredDraft: vi.fn(),
  handleSaveAndContinue: vi.fn(async () => {}),
  handleTakeOverPostEditing: vi.fn(async () => {}),
  isDeleteProjectConfirmationValid: false,
  isDeletingCollectionEntry: false,
  isDeletingPosts: false,
  isDeletingProject: false,
  isPostsCollection: false,
  isSaving: false,
  isSavingProjectSettings: false,
  loadPostRevisions: vi.fn(async () => {}),
  loadingPostRevisions: false,
  lostPostAccessState: null,
  onDeleteProjectConfirmationChange: vi.fn(),
  onPendingPostsDeleteChange: vi.fn(),
  onPendingRevisionRestoreChange: vi.fn(),
  onPendingTaxonomyDeleteChange: vi.fn(),
  onPostsMappingDialogOpenChange: vi.fn(),
  onProjectSlugUnlockDialogOpenChange: vi.fn(),
  onRevisionSheetOpenChange: vi.fn(),
  onShowDeleteProjectDialogChange: vi.fn(),
  pendingLostPostDraftRestore: null,
  pendingPostTakeover: null,
  pendingPostsDelete: null,
  pendingRevisionRestore: null,
  pendingStoredDraftRestore: null,
  pendingTaxonomyDelete: null,
  pendingUnsavedChangesAction: null,
  postContentView: "list",
  postRevisions: [],
  postRevisionsLoadError: null,
  postsMappingDialogContent: <MappingDraftProbe />,
  restoringRevisionNumber: null,
  savingPostsMapping: false,
  selectedPost: null,
  showDeleteProjectDialog: false,
  showMappingConfirmDialog: false,
  showPostRevisionsSheet: false,
  showPostsMappingDialog: false,
  showProjectSlugUnlockDialog: false,
  onShowMappingConfirmDialogChange: vi.fn(),
  onUnsavedChangesDialogOpenChange: vi.fn(),
  ...overrides,
});

describe("project editor dialogs", () => {
  it("keeps the mapping workspace mounted across close and reopen after it has been rendered", () => {
    const { rerender } = render(
      <ProjectEditorDialogs {...createProps({ showPostsMappingDialog: true })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Update draft" }));
    expect(screen.getByTestId("mapping-draft-value")).toHaveTextContent("updated");

    rerender(<ProjectEditorDialogs {...createProps({ showPostsMappingDialog: false })} />);
    rerender(<ProjectEditorDialogs {...createProps({ showPostsMappingDialog: true })} />);

    expect(screen.getByTestId("mapping-draft-value")).toHaveTextContent("updated");
  });

  it("gives the posts mapping dialog an accessible name", () => {
    render(<ProjectEditorDialogs {...createProps({ showPostsMappingDialog: true })} />);

    expect(
      screen.getByRole("dialog", { name: "Connect BaseBuddy to your content" }),
    ).toBeInTheDocument();
  });

  it("explains saved content mapping access without table-first copy", () => {
    render(<ProjectEditorDialogs {...createProps({ showMappingConfirmDialog: true })} />);

    expect(screen.getByText("Save content mapping?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Team members with access to this project will be able to view and edit content from the sources you connected. Make sure those sources only include content you're comfortable sharing with them.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tables you've mapped/i)).not.toBeInTheDocument();
  });
});
