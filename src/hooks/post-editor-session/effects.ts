import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { ContentPost } from "@/lib/content-runtime/shared";
import {
  createPostEditorLocalAutosaveStorage,
  type StoredLostPostDraftBackup,
  type StoredPostDraft,
  type StoredPostDraftSession,
} from "@/lib/editor/post-editor-local-autosave";
import { resolvePostNavigationGuard, shouldRestoreLocalAutosave } from "@/lib/editor/post-editor-rules";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";

import type {
  LostPostAccessState,
  PendingLostPostDraftRestore,
  PendingPostTakeover,
  PendingStoredDraftRestore,
  PostContentView,
  PostEditSessionResponse,
  ReadOnlyPostAccessState,
} from "@/hooks/post-editor-session/types";
import { getPostTitle, getRequestErrorStatus } from "@/hooks/post-editor-session/utils";
import { releasePostEditSessionRequest } from "@/hooks/post-editor-session/api";

type PostEditorAutosaveStorage = ReturnType<typeof createPostEditorLocalAutosaveStorage>;

type UsePostEditorWindowLifecycleEffectsArgs = {
  activePostEditSessionPostIdRef: MutableRefObject<string | null>;
  browserNavigationBypassRef: MutableRefObject<boolean>;
  browserNavigationGuardUrlRef: MutableRefObject<string | null>;
  currentBrowserUrlRef: MutableRefObject<string>;
  flushCurrentPostAutosaveNow: (sessionState: "active" | "recoverable") => boolean;
  hasUnsavedPostChangesNow: () => boolean;
  pathname: string;
  pendingUnsavedChangesActionRef: MutableRefObject<(() => void | Promise<void>) | null>;
  postContentView: PostContentView;
  postContentViewRef: MutableRefObject<PostContentView>;
  prepareForNavigationAwayFromPostEditor?: () => Promise<boolean>;
  projectId: string;
  requestUnsavedChangesConfirmation: (
    action: () => void | Promise<void>,
    proceedLabel?: string,
    onCancel?: () => void,
  ) => void;
  routePostId: string | null;
  searchParamsString: string;
  selectedCollection: string;
  selectedCollectionRef: MutableRefObject<string>;
  selectedPostId: string | null;
};

export const shouldUsePostEditorBrowserNavigationGuard = ({
  postContentView,
  routePostId,
  selectedCollection,
  selectedPostId,
}: {
  postContentView: PostContentView;
  routePostId: string | null;
  selectedCollection: string;
  selectedPostId: string | null;
}) =>
  selectedCollection === "Posts" &&
  postContentView === "editor" &&
  Boolean(selectedPostId) &&
  routePostId === selectedPostId;

export const usePostEditorWindowLifecycleEffects = ({
  activePostEditSessionPostIdRef,
  browserNavigationBypassRef,
  browserNavigationGuardUrlRef,
  currentBrowserUrlRef,
  flushCurrentPostAutosaveNow,
  hasUnsavedPostChangesNow,
  pathname,
  pendingUnsavedChangesActionRef,
  postContentView,
  postContentViewRef,
  prepareForNavigationAwayFromPostEditor,
  projectId,
  requestUnsavedChangesConfirmation,
  routePostId,
  searchParamsString,
  selectedCollection,
  selectedCollectionRef,
  selectedPostId,
}: UsePostEditorWindowLifecycleEffectsArgs) => {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!flushCurrentPostAutosaveNow("recoverable")) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    const handlePageHide = () => {
      const currentPostId = activePostEditSessionPostIdRef.current;

      flushCurrentPostAutosaveNow("recoverable");

      if (!currentPostId) {
        return;
      }

      void releasePostEditSessionRequest(projectId, currentPostId, {
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const shouldUseBrowserGuard = shouldUsePostEditorBrowserNavigationGuard({
      postContentView,
      routePostId,
      selectedCollection,
      selectedPostId,
    });

    if (!shouldUseBrowserGuard) {
      browserNavigationGuardUrlRef.current = null;
      return;
    }

    const currentUrl = currentBrowserUrlRef.current;

    if (!currentUrl || browserNavigationGuardUrlRef.current === currentUrl) {
      return;
    }

    window.history.pushState({ basebuddyEditorGuard: projectId }, "", currentUrl);
    browserNavigationGuardUrlRef.current = currentUrl;
  }, [
    browserNavigationGuardUrlRef,
    currentBrowserUrlRef,
    pathname,
    postContentView,
    projectId,
    routePostId,
    searchParamsString,
    selectedCollection,
    selectedPostId,
  ]);

  useEffect(() => {
    const restoreCurrentUrlGuard = () => {
      const currentUrl = currentBrowserUrlRef.current;

      if (!currentUrl) {
        return;
      }

      window.history.pushState({ basebuddyEditorGuard: projectId }, "", currentUrl);
      browserNavigationGuardUrlRef.current = currentUrl;
    };

    const leaveEditorThroughBrowserHistory = async () => {
      const canLeave = (await prepareForNavigationAwayFromPostEditor?.()) ?? true;

      if (!canLeave) {
        restoreCurrentUrlGuard();
        return;
      }

      browserNavigationBypassRef.current = true;
      browserNavigationGuardUrlRef.current = null;
      window.history.back();
    };

    const handlePopState = () => {
      if (browserNavigationBypassRef.current) {
        browserNavigationBypassRef.current = false;
        return;
      }

      if (selectedCollectionRef.current !== "Posts" || postContentViewRef.current !== "editor") {
        return;
      }

      const decision = resolvePostNavigationGuard({
        hasPendingConfirmation: Boolean(pendingUnsavedChangesActionRef.current),
        hasUnsavedChanges: hasUnsavedPostChangesNow(),
      });

      if (decision === "block-navigation") {
        browserNavigationBypassRef.current = true;
        window.history.forward();
        return;
      }

      if (decision === "confirm-navigation") {
        requestUnsavedChangesConfirmation(
          () => leaveEditorThroughBrowserHistory(),
          "Discard and Leave",
          () => restoreCurrentUrlGuard(),
        );
        return;
      }

      void leaveEditorThroughBrowserHistory();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareForNavigationAwayFromPostEditor, projectId, requestUnsavedChangesConfirmation]);
};

type UsePostEditorSessionLifecycleEffectsArgs = {
  acquiringPostEditSession: boolean;
  activePostEditSessionPostId: string | null;
  beginPostEditSession: (args: {
    force?: boolean;
    post: ContentPost;
    shouldApply?: () => boolean;
  }) => Promise<PostEditSessionResponse>;
  handlePostEditCapabilityError: (args: {
    message: string;
    post: ContentPost;
    source: "acquire" | "heartbeat";
    status?: number;
  }) => Promise<boolean>;
  handlePostEditSessionHeartbeatResult: (
    post: ContentPost,
    payload: PostEditSessionResponse,
  ) => Promise<boolean>;
  heartbeatPostEditSession: (post: ContentPost) => Promise<PostEditSessionResponse>;
  isContentReady: boolean;
  isSavingRef: MutableRefObject<boolean>;
  loadingSelectedPost: boolean;
  lostPostAccessState: LostPostAccessState | null;
  onSessionErrorRef: MutableRefObject<((message: string) => void) | undefined>;
  pendingPostTakeover: PendingPostTakeover | null;
  postContentView: PostContentView;
  readOnlyPostAccessState: ReadOnlyPostAccessState | null;
  releasePostEditSession: (postId?: string | null) => Promise<void>;
  selectedCollection: string;
  selectedPost: ContentPost | null;
  selectedPostId: string | null;
  selectedPostLoadError: string | null;
};

export const usePostEditorSessionLifecycleEffects = ({
  acquiringPostEditSession,
  activePostEditSessionPostId,
  beginPostEditSession,
  handlePostEditCapabilityError,
  handlePostEditSessionHeartbeatResult,
  heartbeatPostEditSession,
  isContentReady,
  isSavingRef,
  loadingSelectedPost,
  lostPostAccessState,
  onSessionErrorRef,
  pendingPostTakeover,
  postContentView,
  readOnlyPostAccessState,
  releasePostEditSession,
  selectedCollection,
  selectedPost,
  selectedPostId,
  selectedPostLoadError,
}: UsePostEditorSessionLifecycleEffectsArgs) => {
  const selectedPostSessionKey = selectedPost?.id ?? null;

  useEffect(() => {
    if (
      !selectedPost ||
      !isContentReady ||
      loadingSelectedPost ||
      Boolean(selectedPostLoadError) ||
      selectedCollection !== "Posts" ||
      postContentView !== "editor" ||
      activePostEditSessionPostId === selectedPost.id ||
      acquiringPostEditSession ||
      Boolean(pendingPostTakeover) ||
      Boolean(lostPostAccessState) ||
      Boolean(readOnlyPostAccessState)
    ) {
      return;
    }

    let cancelled = false;

    void beginPostEditSession({
      post: selectedPost,
      shouldApply: () => !cancelled,
    }).catch(async (error) => {
      if (cancelled) {
        return;
      }

      const message =
        getProductionErrorMessage(error, "Could not open this post right now.");
      const handled = await handlePostEditCapabilityError({
        message,
        post: selectedPost,
        source: "acquire",
        status: getRequestErrorStatus(error),
      });

      if (!handled) {
        onSessionErrorRef.current?.(message);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activePostEditSessionPostId,
    acquiringPostEditSession,
    isContentReady,
    loadingSelectedPost,
    lostPostAccessState,
    pendingPostTakeover,
    postContentView,
    readOnlyPostAccessState,
    selectedCollection,
    selectedPostSessionKey,
    selectedPostLoadError,
  ]);

  useEffect(() => {
    if (!activePostEditSessionPostId) {
      return;
    }

    const isStillEditingCurrentPost =
      selectedCollection === "Posts" &&
      postContentView === "editor" &&
      selectedPostId === activePostEditSessionPostId;

    if (isStillEditingCurrentPost) {
      return;
    }

    void releasePostEditSession(activePostEditSessionPostId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePostEditSessionPostId, postContentView, selectedCollection, selectedPostId]);

  useEffect(() => {
    if (!activePostEditSessionPostId || !selectedPost || selectedPost.id !== activePostEditSessionPostId) {
      return;
    }

    let cancelled = false;

    const intervalId = window.setInterval(() => {
      void (async () => {
        if (isSavingRef.current) {
          return;
        }

        try {
          const payload = await heartbeatPostEditSession(selectedPost);

          if (cancelled) {
            return;
          }

          await handlePostEditSessionHeartbeatResult(selectedPost, payload);
        } catch (error) {
          await handlePostEditCapabilityError({
            message: getProductionErrorMessage(error, "Could not refresh editing access right now."),
            post: selectedPost,
            source: "heartbeat",
            status: getRequestErrorStatus(error),
          });
        }
      })();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePostEditSessionPostId, selectedPost]);

  useEffect(() => {
    if (!activePostEditSessionPostId || !selectedPost || selectedPost.id !== activePostEditSessionPostId) {
      return;
    }

    const checkLockOwnership = () => {
      if (isSavingRef.current) {
        return;
      }

      void (async () => {
        try {
          const payload = await heartbeatPostEditSession(selectedPost);
          await handlePostEditSessionHeartbeatResult(selectedPost, payload);
        } catch (error) {
          await handlePostEditCapabilityError({
            message: getProductionErrorMessage(error, "Could not refresh editing access right now."),
            post: selectedPost,
            source: "heartbeat",
            status: getRequestErrorStatus(error),
          });
        }
      })();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkLockOwnership();
      }
    };

    window.addEventListener("focus", checkLockOwnership);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", checkLockOwnership);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePostEditSessionPostId, selectedPost]);
};

type UsePostEditorAutosaveEffectsArgs = {
  applyRestoredDraftSnapshot: (args: {
    postId: string;
    selectedPost: ContentPost;
    storedDraft: StoredLostPostDraftBackup | StoredPostDraft;
  }) => void;
  autosaveStorage: PostEditorAutosaveStorage;
  browserSessionIdRef: MutableRefObject<string>;
  canEditCurrentPost: boolean;
  clearStoredPostDraftState: (postId?: string | null) => Promise<void>;
  hasComparableUnsavedPostChanges: (args: {
    draftPost: ContentPost | null | undefined;
    isEditingSlug: boolean;
    persistedPost: ContentPost | null | undefined;
    slugDraft: string;
  }) => boolean;
  isEditingPostSlug: boolean;
  isPostSlugAutoManaged: (postId: string) => boolean;
  isSaving: boolean;
  localAutosaveWriteRequestIdRef: MutableRefObject<number>;
  lostPostAccessState: LostPostAccessState | null;
  onStoredDraftRestoredRef: MutableRefObject<(() => void) | undefined>;
  pendingLostPostDraftRestore: PendingLostPostDraftRestore | null;
  pendingStoredDraftRestore: PendingStoredDraftRestore | null;
  persistedPostsRef: MutableRefObject<Record<string, ContentPost>>;
  postContentView: PostContentView;
  postSlugDraft: string;
  posts: ContentPost[];
  promptedLostPostDraftPostIdRef: MutableRefObject<string | null>;
  promptedStoredDraftPostIdRef: MutableRefObject<string | null>;
  readStoredPostDraftSession: () => StoredPostDraftSession | null;
  restoredStoredDraftPostIdRef: MutableRefObject<string | null>;
  restoringLostPostDraftPostIdRef: MutableRefObject<string | null>;
  restoringStoredDraftPostIdRef: MutableRefObject<string | null>;
  selectedCollection: string;
  selectedPost: ContentPost | null;
  setIsPersistingLocalAutosave: Dispatch<SetStateAction<boolean>>;
  setPendingLostPostDraftRestore: Dispatch<SetStateAction<PendingLostPostDraftRestore | null>>;
  setPendingStoredDraftRestore: Dispatch<SetStateAction<PendingStoredDraftRestore | null>>;
  writeStoredPostDraftSessionState: (postId: string, state: "active" | "recoverable") => void;
  draftPostsRef: MutableRefObject<Record<string, ContentPost>>;
};

export const usePostEditorAutosaveEffects = ({
  applyRestoredDraftSnapshot,
  autosaveStorage,
  browserSessionIdRef,
  canEditCurrentPost,
  clearStoredPostDraftState,
  draftPostsRef,
  hasComparableUnsavedPostChanges,
  isEditingPostSlug,
  isPostSlugAutoManaged,
  isSaving,
  localAutosaveWriteRequestIdRef,
  lostPostAccessState,
  onStoredDraftRestoredRef,
  pendingLostPostDraftRestore,
  pendingStoredDraftRestore,
  persistedPostsRef,
  postContentView,
  postSlugDraft,
  posts,
  promptedLostPostDraftPostIdRef,
  promptedStoredDraftPostIdRef,
  readStoredPostDraftSession,
  restoredStoredDraftPostIdRef,
  restoringLostPostDraftPostIdRef,
  restoringStoredDraftPostIdRef,
  selectedCollection,
  selectedPost,
  setIsPersistingLocalAutosave,
  setPendingLostPostDraftRestore,
  setPendingStoredDraftRestore,
  writeStoredPostDraftSessionState,
}: UsePostEditorAutosaveEffectsArgs) => {
  useEffect(() => {
    const currentPostId = selectedPost?.id;

    if (selectedCollection !== "Posts" || postContentView !== "editor" || !currentPostId) {
      setIsPersistingLocalAutosave(false);
      return;
    }

    const draftPost = draftPostsRef.current[currentPostId] ?? selectedPost;

    if (!draftPost) {
      setIsPersistingLocalAutosave(false);
      return;
    }

    const persistedPost = persistedPostsRef.current[currentPostId] ?? null;
    const hasUnsavedChanges = hasComparableUnsavedPostChanges({
      draftPost,
      isEditingSlug: isEditingPostSlug,
      persistedPost,
      slugDraft: postSlugDraft,
    });

    if (!hasUnsavedChanges) {
      void clearStoredPostDraftState(currentPostId);
      setIsPersistingLocalAutosave(false);
      return;
    }

    const autosaveTimer = window.setTimeout(() => {
      const draftToStore = draftPostsRef.current[currentPostId] ?? draftPost;
      const persistedToStore = persistedPostsRef.current[currentPostId] ?? persistedPost;
      const requestId = localAutosaveWriteRequestIdRef.current + 1;
      localAutosaveWriteRequestIdRef.current = requestId;
      setIsPersistingLocalAutosave(true);

      void (async () => {
        try {
          await autosaveStorage.writeStoredPostDraft(currentPostId, {
            isSlugAutoManaged: isPostSlugAutoManaged(currentPostId),
            isEditingPostSlug,
            persistedPost: persistedToStore,
            post: draftToStore,
            postSlugDraft,
          });
          writeStoredPostDraftSessionState(currentPostId, "active");
        } finally {
          if (localAutosaveWriteRequestIdRef.current === requestId) {
            setIsPersistingLocalAutosave(false);
          }
        }
      })();
    }, 1500);

    return () => {
      window.clearTimeout(autosaveTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveStorage, isEditingPostSlug, isSaving, postContentView, postSlugDraft, selectedCollection, selectedPost]);

  useEffect(() => {
    if (selectedCollection !== "Posts" || postContentView !== "editor" || !selectedPost?.id) {
      return;
    }

    const storedSession = readStoredPostDraftSession();

    if (!storedSession?.postId || storedSession.postId !== selectedPost.id) {
      return;
    }

    const isRecoverableSession =
      storedSession.state === "recoverable" ||
      storedSession.sessionId !== browserSessionIdRef.current;

    if (!isRecoverableSession) {
      return;
    }

    if (
      pendingStoredDraftRestore?.postId === storedSession.postId ||
      pendingLostPostDraftRestore?.postId === storedSession.postId ||
      promptedStoredDraftPostIdRef.current === storedSession.postId
    ) {
      return;
    }

    if (
      !shouldRestoreLocalAutosave({
        hasLocalAutosave: true,
        reason: "session_resume",
      })
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const storedDraft = await autosaveStorage.readStoredPostDraft(storedSession.postId);

      if (cancelled) {
        return;
      }

      if (!storedDraft) {
        await clearStoredPostDraftState(storedSession.postId);
        return;
      }

      promptedStoredDraftPostIdRef.current = storedSession.postId;
      setPendingStoredDraftRestore({
        postId: storedSession.postId,
        postTitle: getPostTitle(
          storedDraft.post.title ||
            storedDraft.persistedPost?.title ||
            posts.find((post) => post.id === storedSession.postId)?.title ||
            "",
        ),
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autosaveStorage,
    pendingLostPostDraftRestore?.postId,
    pendingStoredDraftRestore?.postId,
    postContentView,
    selectedCollection,
    selectedPost?.id,
  ]);

  useEffect(() => {
    if (
      restoringStoredDraftPostIdRef.current === null ||
      !selectedPost ||
      selectedCollection !== "Posts" ||
      postContentView !== "editor" ||
      restoringStoredDraftPostIdRef.current !== selectedPost.id ||
      restoredStoredDraftPostIdRef.current === selectedPost.id
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const storedDraft = await autosaveStorage.readStoredPostDraft(selectedPost.id);

      if (cancelled) {
        return;
      }

      if (!storedDraft) {
        restoredStoredDraftPostIdRef.current = selectedPost.id;
        restoringStoredDraftPostIdRef.current = null;
        await clearStoredPostDraftState(selectedPost.id);
        return;
      }

      if (
        !shouldRestoreLocalAutosave({
          hasLocalAutosave: true,
          reason: "session_resume",
        })
      ) {
        restoredStoredDraftPostIdRef.current = selectedPost.id;
        restoringStoredDraftPostIdRef.current = null;
        return;
      }

      applyRestoredDraftSnapshot({
        postId: selectedPost.id,
        selectedPost,
        storedDraft,
      });
      restoredStoredDraftPostIdRef.current = selectedPost.id;
      restoringStoredDraftPostIdRef.current = null;
      onStoredDraftRestoredRef.current?.();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveStorage, postContentView, selectedCollection, selectedPost]);

  useEffect(() => {
    if (
      selectedCollection !== "Posts" ||
      postContentView !== "editor" ||
      !selectedPost?.id ||
      !canEditCurrentPost ||
      Boolean(lostPostAccessState) ||
      Boolean(pendingStoredDraftRestore) ||
      Boolean(pendingLostPostDraftRestore) ||
      promptedLostPostDraftPostIdRef.current === selectedPost.id ||
      restoringLostPostDraftPostIdRef.current === selectedPost.id
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const storedBackup = await autosaveStorage.readLostPostDraftBackup(selectedPost.id);

      if (cancelled || !storedBackup) {
        return;
      }

      promptedLostPostDraftPostIdRef.current = selectedPost.id;
      setPendingLostPostDraftRestore({
        backedUpAt: storedBackup.backedUpAt,
        postId: selectedPost.id,
        postTitle: getPostTitle(
          storedBackup.post.title ||
            storedBackup.persistedPost?.title ||
            posts.find((post) => post.id === selectedPost.id)?.title ||
            "",
        ),
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autosaveStorage,
    canEditCurrentPost,
    lostPostAccessState,
    pendingLostPostDraftRestore,
    pendingStoredDraftRestore,
    postContentView,
    selectedCollection,
    selectedPost?.id,
  ]);

  useEffect(() => {
    if (
      restoringLostPostDraftPostIdRef.current === null ||
      !selectedPost ||
      selectedCollection !== "Posts" ||
      postContentView !== "editor" ||
      restoringLostPostDraftPostIdRef.current !== selectedPost.id
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const storedBackup = await autosaveStorage.readLostPostDraftBackup(selectedPost.id);

      if (cancelled) {
        return;
      }

      if (!storedBackup) {
        restoringLostPostDraftPostIdRef.current = null;
        promptedLostPostDraftPostIdRef.current = null;
        await autosaveStorage.clearLostPostDraftBackup(selectedPost.id);
        return;
      }

      applyRestoredDraftSnapshot({
        postId: selectedPost.id,
        selectedPost,
        storedDraft: storedBackup,
      });
      restoringLostPostDraftPostIdRef.current = null;
      promptedLostPostDraftPostIdRef.current = null;
      await autosaveStorage.clearLostPostDraftBackup(selectedPost.id);
      onStoredDraftRestoredRef.current?.();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveStorage, postContentView, selectedCollection, selectedPost]);
};
