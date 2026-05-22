"use client";

import React, { type ReactNode } from "react";
import {
  Archive,
  BarChart3,
  Check,
  Database,
  Keyboard,
  RotateCcw,
  Save,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import { NavigationLink } from "@/components/editor/navigation-link";
import { PROJECT_EDITOR_SHORTCUTS } from "@/components/editor/project-editor/keyboard-shortcuts";
import type {
  CollectionLabel,
  ProjectEditorToolbarGroup,
} from "@/components/editor/project-editor/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

type ProjectEditorChromeProps = {
  activeSectionLabel: string;
  canArchiveSelectedPost: boolean;
  canDeleteSelectedPost: boolean;
  canPublishSelectedPost: boolean;
  canRestoreSelectedPostToDraft: boolean;
  canToggleSidePanel: boolean;
  children: ReactNode;
  currentProjectName: string;
  hasSelectedPostUnsavedChanges: boolean;
  isArchivedPost: boolean;
  isCurrentPostEditable: boolean;
  isDeletingSelectedPost: boolean;
  isPostsCollection: boolean;
  isPublishedPost: boolean;
  isPublishing: boolean;
  isSaving: boolean;
  isMacKeyboardPlatform: boolean;
  onArchivePost: () => void;
  onDeletePost: () => void;
  onKeyboardShortcutsOpenChange: (open: boolean) => void;
  onNavigateProjects: () => void;
  onOpenSidePanel: () => void;
  onPublish: () => void;
  onRestorePostToDraft: () => void;
  onSavePost: () => void;
  selectedCollection: CollectionLabel;
  showKeyboardShortcuts: boolean;
  showEditorToolbar: boolean;
  showSeoPanel: boolean;
  sidePanel: ReactNode;
  sidePanelToggleIcon: LucideIcon;
  supportsWorkflowActions: boolean;
  toolbarDisabled: boolean;
  toolbarGroups: ProjectEditorToolbarGroup[];
  topBarStatusLabel: string | null;
};

const getSaveActionTitle = ({
  hasSelectedPostUnsavedChanges,
  isCurrentPostEditable,
  isMacKeyboardPlatform,
  isPublishing,
  isPublishedPost,
  isSaving,
  supportsWorkflowActions,
}: {
  hasSelectedPostUnsavedChanges: boolean;
  isCurrentPostEditable: boolean;
  isMacKeyboardPlatform: boolean;
  isPublishing: boolean;
  isPublishedPost: boolean;
  isSaving: boolean;
  supportsWorkflowActions: boolean;
}) => {
  if (isSaving) {
    return isPublishedPost && supportsWorkflowActions ? "Updating the post..." : "Saving the post...";
  }

  if (isPublishing) {
    return "Wait for publishing to finish before saving again.";
  }

  if (!isCurrentPostEditable) {
    return "Editing access is required before you can save changes.";
  }

  if (!hasSelectedPostUnsavedChanges) {
    return "No unsaved changes to save.";
  }

  return `Save (${isMacKeyboardPlatform ? "Cmd+S" : "Ctrl+S"})`;
};

const getPublishActionTitle = ({
  canPublishSelectedPost,
  isCurrentPostEditable,
  isPublishing,
}: {
  canPublishSelectedPost: boolean;
  isCurrentPostEditable: boolean;
  isPublishing: boolean;
}) => {
  if (isPublishing) {
    return "Publishing the post...";
  }

  if (!isCurrentPostEditable) {
    return "Editing access is required before you can publish.";
  }

  if (!canPublishSelectedPost) {
    return "Draft posts need a title before they can be published.";
  }

  return "Publish this draft";
};

export function ProjectEditorChrome({
  activeSectionLabel,
  canArchiveSelectedPost,
  canDeleteSelectedPost,
  canPublishSelectedPost,
  canRestoreSelectedPostToDraft,
  canToggleSidePanel,
  children,
  currentProjectName,
  hasSelectedPostUnsavedChanges,
  isArchivedPost,
  isCurrentPostEditable,
  isDeletingSelectedPost,
  isPostsCollection,
  isPublishedPost,
  isPublishing,
  isSaving,
  isMacKeyboardPlatform,
  onArchivePost,
  onDeletePost,
  onKeyboardShortcutsOpenChange,
  onNavigateProjects,
  onOpenSidePanel,
  onPublish,
  onRestorePostToDraft,
  onSavePost,
  selectedCollection,
  showKeyboardShortcuts,
  showEditorToolbar,
  showSeoPanel,
  sidePanel,
  sidePanelToggleIcon: SidePanelToggleIcon,
  supportsWorkflowActions,
  toolbarDisabled,
  toolbarGroups,
  topBarStatusLabel,
}: ProjectEditorChromeProps) {
  const shortcutGroups = PROJECT_EDITOR_SHORTCUTS.reduce<
    Record<"Editor" | "Structure" | "Text", (typeof PROJECT_EDITOR_SHORTCUTS)[number][]>
  >(
    (groups, shortcut) => {
      groups[shortcut.group].push(shortcut);
      return groups;
    },
    {
      Editor: [],
      Structure: [],
      Text: [],
    },
  );
  const saveActionTitle = getSaveActionTitle({
    hasSelectedPostUnsavedChanges,
    isCurrentPostEditable,
    isMacKeyboardPlatform,
    isPublishing,
    isPublishedPost,
    isSaving,
    supportsWorkflowActions,
  });
  const publishActionTitle = getPublishActionTitle({
    canPublishSelectedPost,
    isCurrentPostEditable,
    isPublishing,
  });
  return (
    <SidebarInset className="h-svh overflow-hidden pt-12">
      <nav className="fixed inset-x-0 top-0 z-20 flex-shrink-0 border-b border-border bg-background">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="h-8 w-8 text-muted-foreground" />
            <NavigationLink
              href="/projects"
              className="flex h-12 items-center"
              onPlainNavigation={onNavigateProjects}
            >
              <BaseBuddyWordmark className="h-6 w-auto" />
            </NavigationLink>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs text-foreground">{currentProjectName}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs text-foreground">{activeSectionLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {topBarStatusLabel ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="h-4 w-4 text-muted-foreground" />
                <span>{topBarStatusLabel}</span>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {showEditorToolbar ? (
          <div
            data-project-editor-toolbar="true"
            className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2"
          >
            {toolbarGroups.map((group, groupIndex) => (
              <div key={`toolbar-group-${groupIndex}`} className="flex items-center">
                {group.map((tool) => (
                  <button
                    key={tool.label}
                    type="button"
                    title={tool.shortcutLabel ? `${tool.label} (${tool.shortcutLabel})` : tool.label}
                    aria-label={tool.shortcutLabel ? `${tool.label} (${tool.shortcutLabel})` : tool.label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={tool.run}
                    disabled={toolbarDisabled}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    <tool.icon className="h-4 w-4" />
                  </button>
                ))}
                {groupIndex < toolbarGroups.length - 1 ? <div className="mx-1 h-5 w-px bg-border" /> : null}
              </div>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title={`Keyboard shortcuts (${isMacKeyboardPlatform ? "Cmd+/" : "Ctrl+/"})`}
                aria-label="Keyboard shortcuts"
                onClick={() => onKeyboardShortcutsOpenChange(true)}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
              <Button
                variant={isPublishedPost && supportsWorkflowActions ? "hero" : !supportsWorkflowActions ? "hero" : "outline"}
                size="sm"
                className="min-w-[96px] justify-center gap-1.5 text-xs"
                disabled={!isCurrentPostEditable || isSaving || isPublishing || !hasSelectedPostUnsavedChanges}
                onClick={onSavePost}
                title={saveActionTitle}
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving
                  ? (isPublishedPost && supportsWorkflowActions ? "Updating..." : "Saving...")
                  : (isPublishedPost && supportsWorkflowActions ? "Update" : "Save")}
              </Button>
              {supportsWorkflowActions ? (
                <>
                  {isArchivedPost ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-[112px] justify-center gap-1.5 text-xs"
                      disabled={!canRestoreSelectedPostToDraft}
                      onClick={onRestorePostToDraft}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Move to Draft
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-[96px] justify-center gap-1.5 text-xs"
                      disabled={!canArchiveSelectedPost}
                      onClick={onArchivePost}
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </Button>
                  )}
                  {isPublishedPost ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-[104px] justify-center gap-1.5 text-xs"
                      disabled={!canRestoreSelectedPostToDraft}
                      onClick={onRestorePostToDraft}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Unpublish
                    </Button>
                  ) : !isArchivedPost ? (
                    <Button
                      variant="hero"
                      size="sm"
                      className="min-w-[96px] justify-center gap-1.5 text-xs"
                      disabled={!canPublishSelectedPost}
                      onClick={onPublish}
                      title={publishActionTitle}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isPublishing ? "Publishing..." : "Publish"}
                    </Button>
                  ) : null}
                </>
              ) : null}
              {isPostsCollection ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={!canDeleteSelectedPost || isDeletingSelectedPost}
                  onClick={onDeletePost}
                  title={isDeletingSelectedPost ? "Deleting this post..." : "Delete this post"}
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <Dialog open={showKeyboardShortcuts} onOpenChange={onKeyboardShortcutsOpenChange}>
          <DialogContent className="max-w-2xl gap-5 p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
              <DialogDescription>
                These shortcuts work while focus is inside the post editor.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 sm:grid-cols-2">
              {(["Text", "Structure", "Editor"] as const).map((group) => (
                <section key={group} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {group}
                  </h3>
                  <div className="space-y-2">
                    {shortcutGroups[group].map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-start justify-between gap-4 border-b border-border/70 pb-2 text-sm last:border-b-0 last:pb-0"
                      >
                        <span className="text-foreground">{shortcut.action}</span>
                        <span className="text-right font-mono text-xs text-muted-foreground">
                          {isMacKeyboardPlatform ? shortcut.mac : shortcut.windows}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

          {sidePanel ? (
            sidePanel
          ) : canToggleSidePanel && !showSeoPanel ? (
            <button
              type="button"
              onClick={onOpenSidePanel}
              className="flex items-center border-l border-border bg-card px-2 text-muted-foreground transition-colors hover:text-foreground"
              title={isPostsCollection ? "Show SEO Panel" : `Show ${selectedCollection} Panel`}
            >
              {isPostsCollection ? (
                <BarChart3 className="h-4 w-4" />
              ) : (
                <SidePanelToggleIcon className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
      </div>
    </SidebarInset>
  );
}
