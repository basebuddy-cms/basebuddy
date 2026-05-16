"use client";

import React, { type ReactNode } from "react";

import type { ContentPost, ContentPostRevision } from "@/lib/content-runtime/shared";
import {
  formatRevisionDate,
  getPostStatusBadgeClassName,
  getPostStatusDotClassName,
  getPostTitle,
  getTaxonomyNoun,
} from "@/components/editor/project-editor/utils";
import type {
  PendingPostsDelete,
  PendingTaxonomyDelete,
} from "@/components/editor/project-editor/types";
import type {
  LostPostAccessState,
  PendingLostPostDraftRestore,
  PendingPostTakeover,
  PendingStoredDraftRestore,
  PendingUnsavedChangesAction,
  PostContentView,
} from "@/hooks/post-editor-session/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ProjectEditorDialogsProps = {
  acquiringPostEditSession: boolean;
  canEditCurrentPost: boolean;
  canForcePostTakeover: boolean;
  clearPendingUnsavedChangesConfirmation: (options?: { invokeCancel?: boolean }) => void;
  currentProjectName: string;
  deleteProjectConfirmation: string;
  getEditingSessionLabel: (session: PendingPostTakeover["blockingSession"]) => string;
  handleDeleteProject: () => Promise<void>;
  handleDeleteCollectionEntries: () => Promise<void>;
  handleDeletePosts: () => Promise<void>;
  handleDiscardLostPostDraft: () => Promise<void>;
  handleDiscardStoredDraft: () => Promise<void>;
  handleGoBackFromTakeover: () => void;
  handleLostPostAccessAcknowledge: () => void;
  onConfirmSaveMapping: () => void;
  handleProceedWithoutSaving: () => Promise<void>;
  handleProjectSlugUnlockProceed: () => void;
  handleRestoreLostPostDraft: () => void;
  handleRestorePostRevision: () => Promise<void>;
  handleRestoreStoredDraft: () => void;
  handleSaveAndContinue: () => Promise<void>;
  handleTakeOverPostEditing: () => Promise<void>;
  isDeleteProjectConfirmationValid: boolean;
  isDeletingCollectionEntry: boolean;
  isDeletingPosts: boolean;
  isDeletingProject: boolean;
  isPostsCollection: boolean;
  isSaving: boolean;
  isSavingProjectSettings: boolean;
  loadPostRevisions: (postId: string) => Promise<void>;
  loadingPostRevisions: boolean;
  lostPostAccessState: LostPostAccessState | null;
  onDeleteProjectConfirmationChange: (value: string) => void;
  onPendingPostsDeleteChange: (value: PendingPostsDelete | null) => void;
  onPendingRevisionRestoreChange: (revision: ContentPostRevision | null) => void;
  onPendingTaxonomyDeleteChange: (value: PendingTaxonomyDelete | null) => void;
  onPostsMappingDialogOpenChange: (open: boolean) => void;
  onProjectSlugUnlockDialogOpenChange: (open: boolean) => void;
  onRevisionSheetOpenChange: (open: boolean) => void;
  onShowDeleteProjectDialogChange: (open: boolean) => void;
  pendingLostPostDraftRestore: PendingLostPostDraftRestore | null;
  pendingPostTakeover: PendingPostTakeover | null;
  pendingPostsDelete: PendingPostsDelete | null;
  pendingRevisionRestore: ContentPostRevision | null;
  pendingStoredDraftRestore: PendingStoredDraftRestore | null;
  pendingTaxonomyDelete: PendingTaxonomyDelete | null;
  pendingUnsavedChangesAction: PendingUnsavedChangesAction | null;
  postContentView: PostContentView;
  postRevisions: ContentPostRevision[];
  postRevisionsLoadError: string | null;
  postsMappingDialogContent: ReactNode;
  restoringRevisionNumber: number | null;
  savingPostsMapping: boolean;
  selectedPost: ContentPost | null;
  showDeleteProjectDialog: boolean;
  showMappingConfirmDialog: boolean;
  showPostRevisionsSheet: boolean;
  showPostsMappingDialog: boolean;
  showProjectSlugUnlockDialog: boolean;
  onShowMappingConfirmDialogChange: (open: boolean) => void;
  onUnsavedChangesDialogOpenChange: (open: boolean) => void;
};

export function ProjectEditorDialogs({
  acquiringPostEditSession,
  canEditCurrentPost,
  canForcePostTakeover,
  clearPendingUnsavedChangesConfirmation,
  currentProjectName,
  deleteProjectConfirmation,
  getEditingSessionLabel,
  handleDeleteProject,
  handleDeleteCollectionEntries,
  handleDeletePosts,
  handleDiscardLostPostDraft,
  handleDiscardStoredDraft,
  handleGoBackFromTakeover,
  handleLostPostAccessAcknowledge,
  onConfirmSaveMapping,
  handleProceedWithoutSaving,
  handleProjectSlugUnlockProceed,
  handleRestoreLostPostDraft,
  handleRestorePostRevision,
  handleRestoreStoredDraft,
  handleSaveAndContinue,
  handleTakeOverPostEditing,
  isDeleteProjectConfirmationValid,
  isDeletingCollectionEntry,
  isDeletingPosts,
  isDeletingProject,
  isPostsCollection,
  isSaving,
  isSavingProjectSettings,
  loadPostRevisions,
  loadingPostRevisions,
  lostPostAccessState,
  onDeleteProjectConfirmationChange,
  onPendingPostsDeleteChange,
  onPendingRevisionRestoreChange,
  onPendingTaxonomyDeleteChange,
  onPostsMappingDialogOpenChange,
  onProjectSlugUnlockDialogOpenChange,
  onRevisionSheetOpenChange,
  onShowDeleteProjectDialogChange,
  pendingLostPostDraftRestore,
  pendingPostTakeover,
  pendingPostsDelete,
  pendingRevisionRestore,
  pendingStoredDraftRestore,
  pendingTaxonomyDelete,
  pendingUnsavedChangesAction,
  postContentView,
  postRevisions,
  postRevisionsLoadError,
  postsMappingDialogContent,
  restoringRevisionNumber,
  savingPostsMapping,
  selectedPost,
  showDeleteProjectDialog,
  showMappingConfirmDialog,
  showPostRevisionsSheet,
  showPostsMappingDialog,
  showProjectSlugUnlockDialog,
  onShowMappingConfirmDialogChange,
  onUnsavedChangesDialogOpenChange,
}: ProjectEditorDialogsProps) {
  return (
    <>
      <Sheet
        open={showPostRevisionsSheet}
        onOpenChange={(open) => {
          if (!restoringRevisionNumber) {
            onRevisionSheetOpenChange(open);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Revision history</SheetTitle>
            <SheetDescription>
              {selectedPost
                ? `Saved revisions for ${getPostTitle(selectedPost.title)}. Restoring a revision replaces title, slug, status, content, excerpt, and SEO fields. Author, categories, and tags stay as they are.`
                : "Saved revisions for the selected post."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4 overflow-y-auto pr-1">
            {loadingPostRevisions ? (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                  Loading revision history...
                </div>
              </div>
            ) : postRevisionsLoadError ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{postRevisionsLoadError}</p>
                {selectedPost ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => void loadPostRevisions(selectedPost.id)}
                  >
                    Try again
                  </Button>
                ) : null}
              </div>
            ) : postRevisions.length ? (
              postRevisions.map((revision) => (
                <div key={revision.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">Revision #{revision.revisionNumber}</p>
                        <Badge variant="secondary" className={getPostStatusBadgeClassName(revision.status)}>
                          <span className={getPostStatusDotClassName(revision.status)} />
                          {revision.status}
                        </Badge>
                      </div>
                      <p className="mt-2 truncate text-sm text-foreground">{getPostTitle(revision.title)}</p>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>{formatRevisionDate(revision.createdAt)}</p>
                        <p>{revision.editorEmail?.trim() || "Saved from an unknown editor account"}</p>
                        <p className="truncate">/{revision.slug}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={!canEditCurrentPost || restoringRevisionNumber === revision.revisionNumber}
                      onClick={() => onPendingRevisionRestoreChange(revision)}
                    >
                      {restoringRevisionNumber === revision.revisionNumber ? "Restoring..." : "Restore"}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">No saved revisions are available for this post yet.</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingRevisionRestore)}
        onOpenChange={(open) => {
          if (!open && !restoringRevisionNumber) {
            onPendingRevisionRestoreChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRevisionRestore ? `Restore revision #${pendingRevisionRestore.revisionNumber}?` : "Restore revision?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevisionRestore
                ? `This restores the saved fields from ${formatRevisionDate(pendingRevisionRestore.createdAt)}. Author, category, and tag assignments stay as they are now.`
                : "This restores the selected revision into the current post."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(restoringRevisionNumber)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-foreground text-background hover:bg-foreground/90"
              disabled={!canEditCurrentPost || Boolean(restoringRevisionNumber)}
              onClick={(event) => {
                event.preventDefault();
                void handleRestorePostRevision();
              }}
            >
              {restoringRevisionNumber ? "Restoring..." : "Restore revision"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingTaxonomyDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingCollectionEntry) {
            onPendingTaxonomyDeleteChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingTaxonomyDelete?.label ?? "selected entries"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected{" "}
              {pendingTaxonomyDelete
                ? getTaxonomyNoun(
                    pendingTaxonomyDelete.collection,
                    pendingTaxonomyDelete.ids.length > 1,
                  )
                : "entries"}
              . Posts that use them will keep working, but the assignments will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCollectionEntry}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteCollectionEntries();
              }}
              disabled={isDeletingCollectionEntry}
            >
              {isDeletingCollectionEntry ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingPostsDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingPosts) {
            onPendingPostsDeleteChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingPostsDelete?.label ?? "selected posts"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected{" "}
              {pendingPostsDelete?.ids.length === 1 ? "post" : "posts"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPosts}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeletePosts();
              }}
              disabled={isDeletingPosts}
            >
              {isDeletingPosts ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showMappingConfirmDialog}
        onOpenChange={(open) => {
          if (!open && !savingPostsMapping) {
            onShowMappingConfirmDialogChange(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save content mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              Team members with access to this project will be able to view and edit content from the sources you connected. Make sure those sources only include content you&apos;re comfortable sharing with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingPostsMapping}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-foreground text-background hover:bg-foreground/90"
              disabled={savingPostsMapping}
              onClick={(event) => {
                event.preventDefault();
                onConfirmSaveMapping();
              }}
            >
              {savingPostsMapping ? "Saving..." : "Save mapping"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingPostTakeover)}
        onOpenChange={(open) => {
          if (!open && !acquiringPostEditSession) {
            handleGoBackFromTakeover();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post already in use</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPostTakeover
                ? `${getEditingSessionLabel(pendingPostTakeover.blockingSession)} is already working on ${pendingPostTakeover.postTitle}.`
                : "Another member is already working on this post."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!canForcePostTakeover ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Only owners, admins, and editors can take over an active editing session.
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acquiringPostEditSession} onClick={handleGoBackFromTakeover}>
              Go back
            </AlertDialogCancel>
            {canForcePostTakeover ? (
              <AlertDialogAction
                className="bg-foreground text-background hover:bg-foreground/90"
                disabled={acquiringPostEditSession}
                onClick={(event) => {
                  event.preventDefault();
                  void handleTakeOverPostEditing();
                }}
              >
                {acquiringPostEditSession ? "Taking over..." : "Take over"}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(lostPostAccessState)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editing moved to another member</AlertDialogTitle>
            <AlertDialogDescription>
              {lostPostAccessState
                ? `${lostPostAccessState.takenOverBy} took over ${lostPostAccessState.postTitle}. Your editing access has ended.${
                    lostPostAccessState.preservedDraft ? " Your unsaved changes were kept locally in this browser." : ""
                  }`
                : "Another member took over this post."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-foreground text-background hover:bg-foreground/90"
              onClick={(event) => {
                event.preventDefault();
                handleLostPostAccessAcknowledge();
              }}
            >
              Go back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(
          isPostsCollection &&
            postContentView === "editor" &&
            selectedPost?.id &&
            pendingStoredDraftRestore?.postId === selectedPost.id,
        )}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved draft available</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStoredDraftRestore
                ? `A local recovery draft is available for ${pendingStoredDraftRestore.postTitle}. Restore it or discard it.`
                : "A local recovery draft is available for one of your posts."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(event) => {
                event.preventDefault();
                void handleDiscardStoredDraft();
              }}
            >
              Discard draft
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-foreground text-background hover:bg-foreground/90"
              onClick={(event) => {
                event.preventDefault();
                handleRestoreStoredDraft();
              }}
            >
              Restore draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(
          isPostsCollection &&
            postContentView === "editor" &&
            selectedPost?.id &&
            pendingLostPostDraftRestore?.postId === selectedPost.id,
        )}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preserved takeover draft available</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingLostPostDraftRestore
                ? `A locally preserved draft from the takeover on ${pendingLostPostDraftRestore.postTitle} is available in this browser. Restore it or discard it.`
                : "A locally preserved takeover draft is available for one of your posts."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(event) => {
                event.preventDefault();
                void handleDiscardLostPostDraft();
              }}
            >
              Discard draft
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-foreground text-background hover:bg-foreground/90"
              onClick={(event) => {
                event.preventDefault();
                handleRestoreLostPostDraft();
              }}
            >
              Restore draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showPostsMappingDialog}
        onOpenChange={(open) => {
          if (!savingPostsMapping) {
            onPostsMappingDialogOpenChange(open);
          }
        }}
      >
        <DialogContent
          {...(postsMappingDialogContent ? { forceMount: true as const } : {})}
          className="left-0 top-0 h-screen min-h-screen w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 p-0 shadow-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:rounded-none"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Connect BaseBuddy to your content</DialogTitle>
            <DialogDescription>
              Connect posts, relations, status, and timestamps from your content.
            </DialogDescription>
          </DialogHeader>
          {postsMappingDialogContent}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showProjectSlugUnlockDialog}
        onOpenChange={(open) => {
          if (!isSavingProjectSettings) {
            onProjectSlugUnlockDialogOpenChange(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock project address?</DialogTitle>
            <DialogDescription>Your project address will change if you update it</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onProjectSlugUnlockDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="hero" onClick={handleProjectSlugUnlockProceed}>
              Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteProjectDialog} onOpenChange={onShowDeleteProjectDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {currentProjectName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and immediately removes access for all members. Type{" "}
              <span className="font-medium text-foreground">{currentProjectName}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-project-confirmation" className="text-xs font-medium uppercase tracking-wider">
              Project name
            </Label>
            <Input
              id="delete-project-confirmation"
              value={deleteProjectConfirmation}
              onChange={(event) => onDeleteProjectConfirmationChange(event.target.value)}
              placeholder={currentProjectName}
              className="h-10 border-border"
              disabled={isDeletingProject}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingProject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteProject();
              }}
              disabled={isDeletingProject || !isDeleteProjectConfirmationValid}
            >
              {isDeletingProject ? "Deleting..." : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(pendingUnsavedChangesAction)} onOpenChange={onUnsavedChangesDialogOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{pendingUnsavedChangesAction?.title ?? "Unsaved changes"}</DialogTitle>
            <DialogDescription>
              {pendingUnsavedChangesAction?.description ??
                "You have unsaved changes in this post. Save before leaving or discard them and continue."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => clearPendingUnsavedChangesConfirmation({ invokeCancel: true })}
              disabled={isSaving}
            >
              Keep Editing
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handleProceedWithoutSaving()}
              disabled={isSaving}
            >
              {pendingUnsavedChangesAction?.proceedLabel ?? "Discard and Continue"}
            </Button>
            <Button
              type="button"
              variant="hero"
              size="sm"
              className="shrink-0"
              onClick={() => void handleSaveAndContinue()}
              disabled={isSaving || !canEditCurrentPost}
            >
              {isSaving ? "Saving..." : "Save and Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
