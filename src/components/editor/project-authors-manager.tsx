"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  CreateProjectAuthorPayload,
  DeleteProjectAuthorsPayload,
  ProjectAuthorAssignment,
  ProjectAuthorMember,
  ProjectAuthorsPayload,
  SetProjectAuthorAssignmentPayload,
} from "@/lib/control-plane/authors";
import { getUserDisplayName } from "@/lib/control-plane/utils";
import {
  slugifyContentValue,
  type ContentAuthor,
  type ContentPagination,
} from "@/lib/content-runtime/shared";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { ProjectAuthorsManagerSkeleton } from "@/components/editor/project-authors-manager/skeleton";
import { ProjectAuthorsManagerSidebar } from "@/components/editor/project-authors-manager/sidebar";
import {
  type AuthorAssignmentDraft,
  type AuthorEditorResponse,
  buildAuthorAssignmentDrafts,
  clearCachedAuthorsPayloads,
  defaultPagination,
  getAuthorsErrorMessage,
  readCachedAuthorsPayload,
  type PendingAuthorDelete,
  type PendingAuthorMemberAssignment,
  writeCachedAuthorsPayload,
} from "@/components/editor/project-authors-manager/support";
import { ProjectAuthorsManagerTable } from "@/components/editor/project-authors-manager/table";
import { ProjectAuthorsUnassignedMembers } from "@/components/editor/project-authors-manager/unassigned-members";
import {
  getProjectAuthorsManagerPageQueryOptions,
  projectEditorQueryFamilies,
  projectEditorQueryKeys,
} from "@/components/editor/project-editor/queries";
import { loadProjectEditorReadThroughQuery } from "@/components/editor/project-editor/read-through-query";

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

type ProjectAuthorsManagerProps = {
  canManageAuthors: boolean;
  initialPage?: number;
  onAuthorsChanged?: () => Promise<void> | void;
  onLoadingStateChange?: (isLoading: boolean) => void;
  onPageChange?: (page: number) => void;
  projectId: string;
};

export function ProjectAuthorsManager({
  canManageAuthors,
  initialPage = 1,
  onAuthorsChanged,
  onLoadingStateChange,
  onPageChange,
  projectId,
}: ProjectAuthorsManagerProps) {
  const queryClient = useQueryClient();
  const [authors, setAuthors] = useState<ContentAuthor[]>([]);
  const [authorMembers, setAuthorMembers] = useState<ProjectAuthorMember[]>([]);
  const [authorAssignments, setAuthorAssignments] = useState<ProjectAuthorAssignment[]>([]);
  const [authorAssignmentDrafts, setAuthorAssignmentDrafts] = useState<Record<string, AuthorAssignmentDraft>>({});
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingAuthorDelete>(null);
  const [pagination, setPagination] = useState<ContentPagination>(defaultPagination);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [hasLoadedAuthorMeta, setHasLoadedAuthorMeta] = useState(false);
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [savingAuthorId, setSavingAuthorId] = useState<string | null>(null);
  const [settingUpMemberId, setSettingUpMemberId] = useState<string | null>(null);
  const [deletingAuthorIds, setDeletingAuthorIds] = useState<string[] | null>(null);
  const [pendingMemberAssignments, setPendingMemberAssignments] = useState<PendingAuthorMemberAssignment>({});
  const [editingAuthorId, setEditingAuthorId] = useState<string | null>(null);
  const [newAuthorName, setNewAuthorName] = useState("");
  const [newAuthorSlug, setNewAuthorSlug] = useState("");
  const [newAuthorEmail, setNewAuthorEmail] = useState("");
  const [newAuthorBio, setNewAuthorBio] = useState("");
  const latestLoadRequestRef = useRef(0);
  const lastInitializedProjectIdRef = useRef<string | null>(null);
  const lastNotifiedLoadingRef = useRef<boolean | null>(null);
  const lastNotifiedPageRef = useRef<number | null>(null);
  const onLoadingStateChangeRef = useRef(onLoadingStateChange);

  useEffect(() => {
    onLoadingStateChangeRef.current = onLoadingStateChange;
  }, [onLoadingStateChange]);

  const applyPayload = useCallback((payload: ProjectAuthorsPayload, options?: { persist?: boolean }) => {
    const nextAuthorMembers = payload.authorMembers ?? authorMembers;
    const nextAssignments = payload.assignments ?? authorAssignments;
    const normalizedPayload: ProjectAuthorsPayload = {
      assignments: nextAssignments,
      authorMembers: nextAuthorMembers,
      authors: payload.authors,
      pagination: payload.pagination,
    };

    setAuthors(payload.authors);
    setAuthorMembers(nextAuthorMembers);
    setAuthorAssignments(nextAssignments);
    setPagination(payload.pagination);
    setAuthorAssignmentDrafts(buildAuthorAssignmentDrafts(payload.authors, nextAssignments));
    setSelectedAuthorIds((currentIds) =>
      currentIds.filter((id) => payload.authors.some((author) => author.id === id)),
    );
    setHasLoadedSnapshot(true);

    if (payload.authorMembers || payload.assignments) {
      setHasLoadedAuthorMeta(true);
    }

    if (options?.persist !== false) {
      writeCachedAuthorsPayload(projectId, normalizedPayload);
    }
  }, [authorAssignments, authorMembers, projectId]);

  const loadAuthors = useCallback(async (page = 1, options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    const pageSize = pagination.pageSize;
    const includeMeta = force || !hasLoadedAuthorMeta;
    await loadProjectEditorReadThroughQuery({
      applyPayload,
      fetchFreshPayload: () =>
        queryClient.fetchQuery({
          ...getProjectAuthorsManagerPageQueryOptions({
            includeMeta,
            page,
            pageSize,
            projectId,
          }),
          ...(force ? { staleTime: 0 } : {}),
        }),
      force,
      getCachedPayload: () => readCachedAuthorsPayload(projectId, page, pageSize),
      getErrorMessage: (error) =>
        getProductionErrorMessage(error, "Could not load project authors right now."),
      getQueryPayload: () =>
        queryClient.getQueryData<ProjectAuthorsPayload>(
          projectEditorQueryKeys.authorsManagerPage({
            includeMeta,
            page,
            pageSize,
            projectId,
          }),
        ),
      latestRequestRef: latestLoadRequestRef,
      setErrorMessage,
      setLoading,
      setRefreshing,
    });
  }, [applyPayload, hasLoadedAuthorMeta, pagination.pageSize, projectId, queryClient]);

  useEffect(() => {
    if (
      lastInitializedProjectIdRef.current === projectId &&
      hasLoadedSnapshot &&
      pagination.page === initialPage
    ) {
      return;
    }

    lastInitializedProjectIdRef.current = projectId;
    setAuthors([]);
    setAuthorMembers([]);
    setAuthorAssignments([]);
    setAuthorAssignmentDrafts({});
    setHasLoadedAuthorMeta(false);
    setHasLoadedSnapshot(false);
    setPagination((currentPagination) =>
      currentPagination.page === initialPage
        ? currentPagination
        : {
            ...currentPagination,
            page: initialPage,
          },
    );
    void loadAuthors(initialPage);
  }, [hasLoadedSnapshot, initialPage, loadAuthors, pagination.page, projectId]);

  useEffect(() => {
    const nextLoading = loading || refreshing;

    if (lastNotifiedLoadingRef.current === nextLoading) {
      return;
    }

    lastNotifiedLoadingRef.current = nextLoading;
    onLoadingStateChange?.(nextLoading);
  }, [loading, onLoadingStateChange, refreshing]);

  useEffect(
    () => () => {
      if (lastNotifiedLoadingRef.current) {
        onLoadingStateChangeRef.current?.(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (lastNotifiedPageRef.current === pagination.page) {
      return;
    }

    lastNotifiedPageRef.current = pagination.page;
    onPageChange?.(pagination.page);
  }, [onPageChange, pagination.page]);

  const paginationPages = useMemo(() => {
    if (pagination.totalPages <= 1) {
      return [];
    }

    const pages = new Set<number>([
      1,
      pagination.totalPages,
      pagination.page,
      pagination.page - 1,
      pagination.page + 1,
    ]);

    return Array.from(pages)
      .filter((page) => page >= 1 && page <= pagination.totalPages)
      .sort((left, right) => left - right);
  }, [pagination.page, pagination.totalPages]);

  const updateAuthorDraft = (authorId: string, updater: (draft: AuthorAssignmentDraft) => AuthorAssignmentDraft) => {
    setAuthorAssignmentDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[authorId];

      if (!currentDraft) {
        return currentDrafts;
      }

      return {
        ...currentDrafts,
        [authorId]: updater(currentDraft),
      };
    });
  };

  const toggleAuthorSelection = (authorId: string, selected: boolean) => {
    setSelectedAuthorIds((currentIds) => {
      if (selected) {
        return currentIds.includes(authorId) ? currentIds : [...currentIds, authorId];
      }

      return currentIds.filter((id) => id !== authorId);
    });
  };

  const toggleAllAuthorSelection = (selected: boolean) => {
    setSelectedAuthorIds(selected ? authors.map((author) => author.id) : []);
  };

  const handleCreateAuthor = async () => {
    if (!newAuthorName.trim() || !canManageAuthors) {
      return;
    }

    setCreatingAuthor(true);

    try {
      const payload: CreateProjectAuthorPayload = {
        action: "create_author",
        bio: newAuthorBio.trim() || null,
        email: newAuthorEmail.trim() || null,
        name: newAuthorName.trim(),
        slug: newAuthorSlug.trim() || null,
      };

      const response = await fetch(`/api/projects/${projectId}/authors`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getAuthorsErrorMessage(response));
      }

      clearCachedAuthorsPayloads(projectId);
      queryClient.invalidateQueries({
        queryKey: projectEditorQueryFamilies.authorsManagerPages(projectId),
      });
      applyPayload((await response.json()) as ProjectAuthorsPayload);
      setNewAuthorName("");
      setNewAuthorSlug("");
      setNewAuthorEmail("");
      setNewAuthorBio("");
      setEditingAuthorId(null);
      await onAuthorsChanged?.();
      toast.success("Author created.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not create that author right now."));
    } finally {
      setCreatingAuthor(false);
    }
  };

  const resetAuthorEditor = () => {
    setEditingAuthorId(null);
    setNewAuthorName("");
    setNewAuthorSlug("");
    setNewAuthorEmail("");
    setNewAuthorBio("");
  };

  const applyUpdatedAuthor = (updatedAuthor: ContentAuthor) => {
    setAuthors((currentAuthors) =>
      currentAuthors.map((author) => (author.id === updatedAuthor.id ? updatedAuthor : author)),
    );
  };

  const startEditingAuthor = (author: ContentAuthor) => {
    setEditingAuthorId(author.id);
    setNewAuthorName(author.name);
    setNewAuthorSlug(author.slug);
    setNewAuthorEmail(author.email ?? "");
    setNewAuthorBio(author.bio ?? "");
  };

  const handleUpdateAuthor = async () => {
    if (!editingAuthorId || !newAuthorName.trim() || !canManageAuthors) {
      return;
    }

    setCreatingAuthor(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/content`, {
        body: JSON.stringify({
          action: "update_collection_entry",
          bio: newAuthorBio.trim() || null,
          collection: "authors",
          email: newAuthorEmail.trim() || null,
          entryId: editingAuthorId,
          name: newAuthorName.trim(),
          slug: newAuthorSlug.trim() || null,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as AuthorEditorResponse;

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error ?? "Could not update that author right now.");
      }

      clearCachedAuthorsPayloads(projectId);
      queryClient.invalidateQueries({
        queryKey: projectEditorQueryFamilies.authorsManagerPages(projectId),
      });
      applyUpdatedAuthor(payload.entry);
      resetAuthorEditor();
      await onAuthorsChanged?.();
      toast.success("Author updated.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not update that author right now."));
    } finally {
      setCreatingAuthor(false);
    }
  };

  const handleSaveAssignment = async (authorId: string) => {
    const draft = authorAssignmentDrafts[authorId];

    if (!draft || !canManageAuthors) {
      return;
    }

    setSavingAuthorId(authorId);

    try {
      const payload: SetProjectAuthorAssignmentPayload = {
        action: "set_author_assignment",
        canPublish: draft.canPublish,
        cmsAuthorId: authorId,
        userId: draft.userId,
      };

      const response = await fetch(
        `/api/projects/${projectId}/authors?page=${pagination.page}&pageSize=${pagination.pageSize}`,
        {
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error(await getAuthorsErrorMessage(response));
      }

      clearCachedAuthorsPayloads(projectId);
      queryClient.invalidateQueries({
        queryKey: projectEditorQueryFamilies.authorsManagerPages(projectId),
      });
      applyPayload((await response.json()) as ProjectAuthorsPayload);
      await onAuthorsChanged?.();
      toast.success("Author assignment updated.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not update that author assignment right now."));
    } finally {
      setSavingAuthorId(null);
    }
  };

  const handleDeleteAuthors = async () => {
    if (!pendingDelete || !canManageAuthors) {
      return;
    }

    setDeletingAuthorIds(pendingDelete.ids);

    try {
      const payload: DeleteProjectAuthorsPayload = {
        entryIds: pendingDelete.ids,
      };

      const response = await fetch(`/api/projects/${projectId}/authors`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getAuthorsErrorMessage(response));
      }

      clearCachedAuthorsPayloads(projectId);
      queryClient.invalidateQueries({
        queryKey: projectEditorQueryFamilies.authorsManagerPages(projectId),
      });
      applyPayload((await response.json()) as ProjectAuthorsPayload);
      await onAuthorsChanged?.();
      setPendingDelete(null);
      toast.success(pendingDelete.ids.length === 1 ? "Author deleted." : "Authors deleted.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not delete those authors right now."));
    } finally {
      setDeletingAuthorIds(null);
    }
  };

  if (!canManageAuthors) {
    return (
      <div className="mx-auto flex h-full max-w-3xl items-center px-8 py-10">
        <div className="w-full rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Only project owners and admins can manage authors.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    if (!hasLoadedSnapshot) {
      return <ProjectAuthorsManagerSkeleton />;
    }
  }

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="text-sm text-destructive">{errorMessage}</p>
      </div>
    );
  }

  const hasSelectedAuthors = selectedAuthorIds.length > 0;
  const assignedAuthorMemberIds = new Set(
    Object.values(authorAssignmentDrafts)
      .map((draft) => draft.userId)
      .filter((userId): userId is string => Boolean(userId)),
  );
  const unassignedAuthorMembers = authorMembers.filter((member) => !assignedAuthorMemberIds.has(member.userId));

  const handleCreateAndAssignAuthor = async (member: ProjectAuthorMember) => {
    if (!canManageAuthors) {
      return;
    }

    const displayName = getUserDisplayName(member.email, member.name);
    setSettingUpMemberId(member.userId);

    try {
      const payload: CreateProjectAuthorPayload = {
        action: "create_author",
        assignUserId: member.userId,
        bio: null,
        email: member.email,
        name: displayName,
        slug: slugifyContentValue(displayName) || null,
      };

      const response = await fetch(`/api/projects/${projectId}/authors`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getAuthorsErrorMessage(response));
      }

      clearCachedAuthorsPayloads(projectId);
      queryClient.invalidateQueries({
        queryKey: projectEditorQueryFamilies.authorsManagerPages(projectId),
      });
      applyPayload((await response.json()) as ProjectAuthorsPayload);
      await onAuthorsChanged?.();
      toast.success("Author created and assigned.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not create and assign that author right now."));
    } finally {
      setSettingUpMemberId(null);
    }
  };

  const handleAssignExistingAuthor = async (member: ProjectAuthorMember) => {
    const cmsAuthorId = pendingMemberAssignments[member.userId];

    if (!cmsAuthorId || !canManageAuthors) {
      return;
    }

    setSettingUpMemberId(member.userId);

    try {
      const payload: SetProjectAuthorAssignmentPayload = {
        action: "set_author_assignment",
        canPublish: true,
        cmsAuthorId,
        userId: member.userId,
      };

      const response = await fetch(
        `/api/projects/${projectId}/authors?page=${pagination.page}&pageSize=${pagination.pageSize}`,
        {
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error(await getAuthorsErrorMessage(response));
      }

      clearCachedAuthorsPayloads(projectId);
      queryClient.invalidateQueries({
        queryKey: projectEditorQueryFamilies.authorsManagerPages(projectId),
      });
      applyPayload((await response.json()) as ProjectAuthorsPayload);
      setPendingMemberAssignments((current) => {
        const next = { ...current };
        delete next[member.userId];
        return next;
      });
      await onAuthorsChanged?.();
      toast.success("Author assigned.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not assign that author right now."));
    } finally {
      setSettingUpMemberId(null);
    }
  };

  return (
    <>
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-8 py-10">
            <div className="mb-8 space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Authors</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Create content authors and map them to project members with the author role.
              </p>
            </div>

            <ProjectAuthorsUnassignedMembers
              authors={authors}
              pendingAssignments={pendingMemberAssignments}
              settingUpMemberId={settingUpMemberId}
              unassignedAuthorMembers={unassignedAuthorMembers}
              onAssignExistingAuthor={(member) => void handleAssignExistingAuthor(member)}
              onCreateAndAssignAuthor={(member) => void handleCreateAndAssignAuthor(member)}
              onPendingAssignmentChange={(memberId, authorId) =>
                setPendingMemberAssignments((current) => ({
                  ...current,
                  [memberId]: authorId,
                }))
              }
            />

            <ProjectAuthorsManagerTable
              authorAssignmentDrafts={authorAssignmentDrafts}
              authorMembers={authorMembers}
              authors={authors}
              deletingAuthorIds={deletingAuthorIds}
              onAuthorDeleteRequest={(author) =>
                setPendingDelete({
                  ids: [author.id],
                  label: author.name,
                })
              }
              onAuthorEditRequest={startEditingAuthor}
              onAssignmentDraftChange={(authorId, nextUserId) =>
                updateAuthorDraft(authorId, (currentDraft) => ({
                  ...currentDraft,
                  isDirty:
                    nextUserId !== currentDraft.originalUserId ||
                    currentDraft.canPublish !== currentDraft.originalCanPublish,
                  userId: nextUserId,
                }))
              }
              onAssignmentPublishChange={(authorId, canPublish) =>
                updateAuthorDraft(authorId, (currentDraft) => ({
                  ...currentDraft,
                  canPublish,
                  isDirty:
                    currentDraft.userId !== currentDraft.originalUserId ||
                    canPublish !== currentDraft.originalCanPublish,
                }))
              }
              onAssignmentSave={(authorId) => void handleSaveAssignment(authorId)}
              onAuthorSelectionChange={toggleAuthorSelection}
              onPageChange={(page) => void loadAuthors(page)}
              onSelectAllChange={toggleAllAuthorSelection}
              pagination={pagination}
              paginationPages={paginationPages}
              savingAuthorId={savingAuthorId}
              selectedAuthorIds={selectedAuthorIds}
            />
          </div>
        </div>

        <ProjectAuthorsManagerSidebar
          creatingAuthor={creatingAuthor}
          editingAuthorId={editingAuthorId}
          hasSelectedAuthors={hasSelectedAuthors}
          newAuthorBio={newAuthorBio}
          newAuthorEmail={newAuthorEmail}
          newAuthorName={newAuthorName}
          newAuthorSlug={newAuthorSlug}
          onAuthorBioChange={setNewAuthorBio}
          onAuthorEmailChange={setNewAuthorEmail}
          onAuthorNameChange={(nextName) => {
            setNewAuthorName(nextName);
            setNewAuthorSlug((currentSlug) => (currentSlug.trim() ? currentSlug : slugifyContentValue(nextName)));
          }}
          onAuthorSlugChange={(value) => setNewAuthorSlug(slugifyContentValue(value))}
          onClearSelection={() => setSelectedAuthorIds([])}
          onDeleteSelected={() =>
            setPendingDelete({
              ids: selectedAuthorIds,
              label:
                selectedAuthorIds.length === 1 ? "selected author" : `${selectedAuthorIds.length} selected authors`,
            })
          }
          onEditorCancel={resetAuthorEditor}
          onSubmit={() => {
            if (editingAuthorId) {
              void handleUpdateAuthor();
              return;
            }

            void handleCreateAuthor();
          }}
          selectedAuthorCount={selectedAuthorIds.length}
        />
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingAuthorIds?.length) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.label ?? "selected authors"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected author records and clear any member assignments attached to
              them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingAuthorIds?.length)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteAuthors();
              }}
              disabled={Boolean(deletingAuthorIds?.length)}
            >
              {deletingAuthorIds?.length ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
