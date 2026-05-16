"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  isContentPostEditorPayloadReady,
  type ContentPost,
} from "@/lib/content-runtime/shared";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import type {
  LostPostAccessState,
  PendingLostPostDraftRestore,
  PendingPostTakeover,
  PendingStoredDraftRestore,
  PendingUnsavedChangesAction,
  PostContentView,
  PostEditCapabilityState,
  PostEditSessionResponse,
  ReadOnlyPostAccessState,
  UsePostEditorSessionArgs,
} from "@/hooks/post-editor-session/types";
import {
  createBrowserSessionId,
  getEditingSessionLabel,
  getPostTitle,
  getRequestErrorStatus,
} from "@/hooks/post-editor-session/utils";
import {
  createPostDraftStateHelpers,
} from "@/hooks/post-editor-session/draft-state";
import {
  createPostSessionTransitionHelpers,
  isRecoverablePostSessionError,
} from "@/hooks/post-editor-session/session-transitions";
import {
  fetchAcquirePostEditSessionRequest,
  heartbeatPostEditSessionRequest,
  releasePostEditSessionRequest,
} from "@/hooks/post-editor-session/api";
import {
  usePostEditorAutosaveEffects,
  usePostEditorSessionLifecycleEffects,
  usePostEditorWindowLifecycleEffects,
} from "@/hooks/post-editor-session/effects";
import {
  createPostEditorLocalAutosaveStorage,
} from "@/lib/editor/post-editor-local-autosave";
import {
  getDisplayedPostSlug,
  resolvePostEditReadOnlyReason,
  resolvePostNavigationGuard,
} from "@/lib/editor/post-editor-rules";

export type {
  LostPostAccessState,
  PendingLostPostDraftRestore,
  PendingPostTakeover,
  PendingStoredDraftRestore,
  PendingUnsavedChangesAction,
  PostContentView,
  PostEditCapabilityState,
  ReadOnlyPostAccessState,
};

const MAX_CONSECUTIVE_HEARTBEAT_REFRESH_FAILURES = 3;

export const usePostEditorSession = ({
  getComparablePostState,
  isContentReady,
  isSaving,
  onSessionError,
  onStoredDraftRestored,
  pathname,
  prepareForNavigationAwayFromPostEditor,
  posts,
  projectId,
  refreshPostsPresence,
  routePostId,
  searchParamsString,
  selectedCollection,
  setPosts,
}: UsePostEditorSessionArgs) => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(routePostId);
  const [isEditingPostSlug, setIsEditingPostSlug] = useState(false);
  const [postSlugDraft, setPostSlugDraft] = useState("");
  const [postContentView, setPostContentView] = useState<PostContentView>(routePostId ? "editor" : "list");
  const [pendingUnsavedChangesAction, setPendingUnsavedChangesAction] =
    useState<PendingUnsavedChangesAction | null>(null);
  const [loadingSelectedPost, setLoadingSelectedPost] = useState(Boolean(routePostId));
  const [selectedPostLoadError, setSelectedPostLoadError] = useState<string | null>(null);
  const [activePostEditSessionPostId, setActivePostEditSessionPostId] = useState<string | null>(null);
  const [acquiringPostEditSession, setAcquiringPostEditSession] = useState(false);
  const [isPersistingLocalAutosave, setIsPersistingLocalAutosave] = useState(false);
  const [pendingPostTakeover, setPendingPostTakeover] = useState<PendingPostTakeover | null>(null);
  const [lostPostAccessState, setLostPostAccessState] = useState<LostPostAccessState | null>(null);
  const [readOnlyPostAccessState, setReadOnlyPostAccessState] = useState<ReadOnlyPostAccessState | null>(null);
  const [pendingStoredDraftRestore, setPendingStoredDraftRestore] =
    useState<PendingStoredDraftRestore | null>(null);
  const [pendingLostPostDraftRestore, setPendingLostPostDraftRestore] =
    useState<PendingLostPostDraftRestore | null>(null);

  const selectedPostIdRef = useRef<string | null>(selectedPostId);
  const selectedCollectionRef = useRef(selectedCollection);
  const postContentViewRef = useRef<PostContentView>(postContentView);
  const persistedPostsRef = useRef<Record<string, ContentPost>>({});
  const draftPostsRef = useRef<Record<string, ContentPost>>({});
  const dirtyPostIdsRef = useRef(new Set<string>());
  const isSavingRef = useRef(isSaving);
  const isEditingPostSlugRef = useRef(isEditingPostSlug);
  const postSlugDraftRef = useRef(postSlugDraft);
  const pendingUnsavedChangesActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const pendingUnsavedChangesCancelActionRef = useRef<(() => void) | null>(null);
  const browserNavigationBypassRef = useRef(false);
  const browserNavigationGuardUrlRef = useRef<string | null>(null);
  const browserSessionIdRef = useRef(createBrowserSessionId());
  const currentBrowserUrlRef = useRef("");
  const restoredStoredDraftPostIdRef = useRef<string | null>(null);
  const restoringStoredDraftPostIdRef = useRef<string | null>(null);
  const promptedStoredDraftPostIdRef = useRef<string | null>(null);
  const restoringLostPostDraftPostIdRef = useRef<string | null>(null);
  const promptedLostPostDraftPostIdRef = useRef<string | null>(null);
  const activePostEditSessionPostIdRef = useRef<string | null>(activePostEditSessionPostId);
  const autoSlugPostIdsRef = useRef(new Set<string>());
  const canEditCurrentPostRef = useRef(false);
  const postEditSessionRequestIdRef = useRef(0);
  const localAutosaveWriteRequestIdRef = useRef(0);
  const heartbeatRefreshFailureCountsRef = useRef<Record<string, number>>({});
  const refreshPostsPresenceRef = useRef(refreshPostsPresence);
  const onSessionErrorRef = useRef(onSessionError);
  const onStoredDraftRestoredRef = useRef(onStoredDraftRestored);
  const releasePostEditSessionOnUnmountRef = useRef<(postId?: string | null) => Promise<void>>(async () => {});
  const pendingPostTakeoverRef = useRef<PendingPostTakeover | null>(pendingPostTakeover);
  const lostPostAccessStateRef = useRef<LostPostAccessState | null>(lostPostAccessState);
  const readOnlyPostAccessStateRef = useRef<ReadOnlyPostAccessState | null>(readOnlyPostAccessState);
  const selectedPostCandidate = posts.find((post) => post.id === selectedPostId) ?? null;
  const selectedPost =
    postContentView === "editor" &&
    selectedPostCandidate &&
    !isContentPostEditorPayloadReady(selectedPostCandidate)
      ? null
      : selectedPostCandidate;
  const postEditCapability: PostEditCapabilityState =
    selectedCollection === "Posts" &&
    postContentView === "editor" &&
    selectedPost?.id &&
    isContentReady
      ? lostPostAccessState?.postId === selectedPost.id
        ? {
            state: "taken_over" as const,
            ...lostPostAccessState,
          }
        : readOnlyPostAccessState?.postId === selectedPost.id
          ? {
              state: "read_only" as const,
              ...readOnlyPostAccessState,
            }
          : pendingPostTakeover?.postId === selectedPost.id
            ? {
                state: "blocked" as const,
                postId: pendingPostTakeover.postId,
                postTitle: pendingPostTakeover.postTitle,
              }
            : activePostEditSessionPostId === selectedPost.id
              ? {
                  state: "editable" as const,
                  postId: selectedPost.id,
                }
              : {
                  state: "acquiring" as const,
                  postId: selectedPost.id,
                }
      : ({ state: "inactive" } as const);
  const canEditCurrentPost = postEditCapability.state === "editable";
  const autosaveStorage = useMemo(() => createPostEditorLocalAutosaveStorage(projectId), [projectId]);

  useEffect(() => {
    selectedPostIdRef.current = selectedPostId;
  }, [selectedPostId]);

  useEffect(() => {
    selectedCollectionRef.current = selectedCollection;
  }, [selectedCollection]);

  useEffect(() => {
    postContentViewRef.current = postContentView;
  }, [postContentView]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    isEditingPostSlugRef.current = isEditingPostSlug;
  }, [isEditingPostSlug]);

  useEffect(() => {
    postSlugDraftRef.current = postSlugDraft;
  }, [postSlugDraft]);

  useEffect(() => {
    currentBrowserUrlRef.current = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;
  }, [pathname, searchParamsString]);

  useEffect(() => {
    activePostEditSessionPostIdRef.current = activePostEditSessionPostId;
  }, [activePostEditSessionPostId]);

  useEffect(() => {
    canEditCurrentPostRef.current = canEditCurrentPost;
  }, [canEditCurrentPost]);

  useEffect(() => {
    refreshPostsPresenceRef.current = refreshPostsPresence;
  }, [refreshPostsPresence]);

  useEffect(() => {
    pendingPostTakeoverRef.current = pendingPostTakeover;
  }, [pendingPostTakeover]);

  useEffect(() => {
    lostPostAccessStateRef.current = lostPostAccessState;
  }, [lostPostAccessState]);

  useEffect(() => {
    readOnlyPostAccessStateRef.current = readOnlyPostAccessState;
  }, [readOnlyPostAccessState]);

  useEffect(() => {
    onSessionErrorRef.current = onSessionError;
  }, [onSessionError]);

  useEffect(() => {
    onStoredDraftRestoredRef.current = onStoredDraftRestored;
  }, [onStoredDraftRestored]);

  useEffect(() => {
    restoredStoredDraftPostIdRef.current = null;
    restoringStoredDraftPostIdRef.current = null;
    promptedStoredDraftPostIdRef.current = null;
    restoringLostPostDraftPostIdRef.current = null;
    promptedLostPostDraftPostIdRef.current = null;
    pendingUnsavedChangesCancelActionRef.current = null;
    browserNavigationGuardUrlRef.current = null;
    setReadOnlyPostAccessState(null);
    setPendingLostPostDraftRestore(null);
    setPendingStoredDraftRestore(null);
    heartbeatRefreshFailureCountsRef.current = {};
  }, [projectId]);

  useEffect(() => {
    if (
      readOnlyPostAccessState &&
      (selectedCollection !== "Posts" ||
        postContentView !== "editor" ||
        selectedPostId !== readOnlyPostAccessState.postId)
    ) {
      setReadOnlyPostAccessState(null);
    }
  }, [postContentView, readOnlyPostAccessState, selectedCollection, selectedPostId]);

  const readStoredPostDraftSession = () => autosaveStorage.readStoredPostDraftSession();

  const clearStoredPostDraftState = async (postId?: string | null) => {
    if (postId && promptedStoredDraftPostIdRef.current === postId) {
      promptedStoredDraftPostIdRef.current = null;
    }

    if (postId && restoredStoredDraftPostIdRef.current === postId) {
      restoredStoredDraftPostIdRef.current = null;
    }

    if (postId && restoringStoredDraftPostIdRef.current === postId) {
      restoringStoredDraftPostIdRef.current = null;
    }

    await autosaveStorage.clearStoredPostDraftState(postId);
  };

  const getDisplayedSelectedPostSlug = (selectedPost: ContentPost | null) =>
    selectedPost
      ? getDisplayedPostSlug({
          autoManaged: isPostSlugAutoManaged(selectedPost.id),
          persistedSlug: selectedPost.slug,
          title: selectedPost.title,
        })
      : "";

  const syncLocalPostEditingSession = useCallback(
    ({
      postId,
      postTitle,
      releaseOnly = false,
    }: {
      postId?: string | null;
      postTitle?: string | null;
      releaseOnly?: boolean;
    }) => {
      const applySessionToPost = (post: ContentPost) => {
        if (releaseOnly) {
          return post.id === postId && post.editingSession?.isCurrentUser
            ? { ...post, editingSession: null }
            : post;
        }

        if (post.id === postId) {
          return {
            ...post,
            editingSession: {
              avatarUrl: null,
              editorEmail: null,
              editorName: null,
              isCurrentUser: true,
              lastHeartbeatAt: new Date().toISOString(),
              postId: post.id,
              postTitle: postTitle ?? post.title,
              userId: "current-user",
            },
          };
        }

        return post.editingSession?.isCurrentUser ? { ...post, editingSession: null } : post;
      };

      setPosts((currentPosts) => currentPosts.map(applySessionToPost));

      for (const currentPostId of Object.keys(persistedPostsRef.current)) {
        const currentPost = persistedPostsRef.current[currentPostId];
        if (currentPost) {
          persistedPostsRef.current[currentPostId] = applySessionToPost(currentPost);
        }
      }

      for (const currentPostId of Object.keys(draftPostsRef.current)) {
        const currentPost = draftPostsRef.current[currentPostId];
        if (currentPost) {
          draftPostsRef.current[currentPostId] = applySessionToPost(currentPost);
        }
      }
    },
    [setPosts],
  );

  const {
    applyRestoredDraftSnapshot,
    backupLostPostDraft,
    flushCurrentPostAutosaveNow: flushCurrentPostAutosaveNowInternal,
    getCurrentPostAutosaveContext,
    hasComparableUnsavedPostChanges,
    isPostSlugAutoManaged,
    markPostDirty,
    markPostPersisted,
    restorePersistedPostDraft,
    writeStoredPostDraftSessionState: writeStoredPostDraftSessionStateInternal,
  } = createPostDraftStateHelpers({
    autoSlugPostIdsRef,
    autosaveStorage,
    clearStoredPostDraftState,
    dirtyPostIdsRef,
    draftPostsRef,
    getComparablePostState,
    isEditingPostSlugRef,
    persistedPostsRef,
    postContentViewRef,
    postSlugDraftRef,
    selectedCollectionRef,
    selectedPostIdRef,
    setIsEditingPostSlug,
    setPostSlugDraft,
    setPosts,
  });

  const flushCurrentPostAutosaveNow = (sessionState: "active" | "recoverable") =>
    flushCurrentPostAutosaveNowInternal(browserSessionIdRef.current, sessionState);

  const writeStoredPostDraftSessionState = (postId: string, state: "active" | "recoverable") =>
    writeStoredPostDraftSessionStateInternal(browserSessionIdRef.current, postId, state);

  const resetHeartbeatRefreshFailureCount = useCallback((postId?: string | null) => {
    if (!postId) {
      heartbeatRefreshFailureCountsRef.current = {};
      return;
    }

    if (!(postId in heartbeatRefreshFailureCountsRef.current)) {
      return;
    }

    const { [postId]: _ignored, ...remainingCounts } = heartbeatRefreshFailureCountsRef.current;
    heartbeatRefreshFailureCountsRef.current = remainingCounts;
  }, []);

  const noteHeartbeatRefreshFailure = useCallback((postId: string) => {
    const nextFailureCount = (heartbeatRefreshFailureCountsRef.current[postId] ?? 0) + 1;
    heartbeatRefreshFailureCountsRef.current[postId] = nextFailureCount;
    return nextFailureCount;
  }, []);

  const releasePostEditSession = useCallback(
    async (postId?: string | null) => {
      if (postId && activePostEditSessionPostIdRef.current === postId) {
        activePostEditSessionPostIdRef.current = null;
        canEditCurrentPostRef.current = false;
        setActivePostEditSessionPostId(null);
      }

      resetHeartbeatRefreshFailureCount(postId);

      syncLocalPostEditingSession({
        postId,
        releaseOnly: true,
      });

      try {
        await releasePostEditSessionRequest(projectId, postId);
      } catch {
        return;
      }
    },
    [
      activePostEditSessionPostIdRef,
      canEditCurrentPostRef,
      projectId,
      resetHeartbeatRefreshFailureCount,
      syncLocalPostEditingSession,
    ],
  );

  useEffect(() => {
    releasePostEditSessionOnUnmountRef.current = releasePostEditSession;
  }, [releasePostEditSession]);

  useEffect(
    () => () => {
      const postId = activePostEditSessionPostIdRef.current;

      if (!postId) {
        return;
      }

      void releasePostEditSessionOnUnmountRef.current(postId);
    },
    [activePostEditSessionPostIdRef],
  );

  const fetchAcquirePostEditSession = async ({
    force = false,
    post,
  }: {
    force?: boolean;
    post: ContentPost;
  }) =>
    fetchAcquirePostEditSessionRequest({
      force,
      post,
      projectId,
    });

  const heartbeatPostEditSession = (post: ContentPost) =>
    heartbeatPostEditSessionRequest({
      post,
      projectId,
    });

  const shouldPreserveAcquiredPostEditSession = (postId: string) =>
    selectedCollectionRef.current === "Posts" &&
    postContentViewRef.current === "editor" &&
    selectedPostIdRef.current === postId &&
    !pendingPostTakeoverRef.current &&
    !lostPostAccessStateRef.current &&
    !readOnlyPostAccessStateRef.current;

  const {
    handlePostEditCapabilityError: handlePostEditCapabilityErrorInternal,
    handlePostEditSessionHeartbeatResult: handlePostEditSessionHeartbeatResultInternal,
    markPostEditSessionActive,
  } = createPostSessionTransitionHelpers({
    activePostEditSessionPostIdRef,
    backupLostPostDraft,
    canEditCurrentPostRef,
    draftPostsRef,
    refreshPostsPresenceRef,
    restorePersistedPostDraft,
    selectedPostIdRef,
    setActivePostEditSessionPostId,
    setIsEditingPostSlug,
    setLostPostAccessState,
    setPendingPostTakeover,
    setPostContentView,
    setPostSlugDraft,
    setReadOnlyPostAccessState,
    setSelectedPostId,
    syncLocalPostEditingSession,
  });

  const handlePostEditCapabilityError = useCallback(
    async ({
      message,
      post,
      source,
      status,
    }: {
      message: string;
      post: ContentPost;
      source: "acquire" | "heartbeat" | "save";
      status?: number;
    }) => {
      const reason = resolvePostEditReadOnlyReason({
        message,
        source,
        status,
      });

      if (source === "heartbeat" && reason === "refresh_failed") {
        const failureCount = noteHeartbeatRefreshFailure(post.id);

        if (failureCount < MAX_CONSECUTIVE_HEARTBEAT_REFRESH_FAILURES) {
          return true;
        }
      }

      const handled = await handlePostEditCapabilityErrorInternal({
        message,
        post,
        source,
        status,
      });

      if (handled) {
        resetHeartbeatRefreshFailureCount(post.id);
      }

      return handled;
    },
    [
      handlePostEditCapabilityErrorInternal,
      noteHeartbeatRefreshFailure,
      resetHeartbeatRefreshFailureCount,
    ],
  );

  const handlePostEditSessionHeartbeatResult = useCallback(
    async (post: ContentPost, payload: PostEditSessionResponse) => {
      resetHeartbeatRefreshFailureCount(post.id);
      return handlePostEditSessionHeartbeatResultInternal(post, payload);
    },
    [handlePostEditSessionHeartbeatResultInternal, resetHeartbeatRefreshFailureCount],
  );

  const beginPostEditSession = async ({
    force = false,
    post,
    shouldApply,
  }: {
    force?: boolean;
    post: ContentPost;
    shouldApply?: () => boolean;
  }) => {
    const requestId = postEditSessionRequestIdRef.current + 1;
    postEditSessionRequestIdRef.current = requestId;
    setAcquiringPostEditSession(true);

    try {
      const payload = await fetchAcquirePostEditSession({ force, post });

      if (shouldApply && !shouldApply()) {
        if (payload.acquired) {
          if (shouldPreserveAcquiredPostEditSession(post.id)) {
            resetHeartbeatRefreshFailureCount(post.id);
            await markPostEditSessionActive(post);
          } else {
            void releasePostEditSession(post.id);
          }
        }

        return payload;
      }

      if (payload.acquired) {
        resetHeartbeatRefreshFailureCount(post.id);
        await markPostEditSessionActive(post);
        return payload;
      }

      setPendingPostTakeover({
        blockingSession: payload.blockingSession ?? null,
        postId: post.id,
        postTitle: getPostTitle(post.title),
      });

      return payload;
    } finally {
      if (postEditSessionRequestIdRef.current === requestId) {
        setAcquiringPostEditSession(false);
      }
    }
  };

  const openPostEditorSession = async (postId: string) => {
    const post = posts.find((entry) => entry.id === postId) ?? null;

    if (!post) {
      return null;
    }

    const payload = await beginPostEditSession({ post });

    return {
      payload,
      post,
    };
  };

  const takeOverPendingPostEditing = async () => {
    if (!pendingPostTakeover) {
      return null;
    }

    const post =
      posts.find((entry) => entry.id === pendingPostTakeover.postId) ??
      (selectedPost?.id === pendingPostTakeover.postId ? selectedPost : null);

    if (!post) {
      setPendingPostTakeover(null);
      return null;
    }

    const payload = await beginPostEditSession({
      force: true,
      post,
    });

    return {
      payload,
      post,
    };
  };

  const dismissPendingPostTakeover = () => {
    setPendingPostTakeover(null);
  };

  const retryCurrentPostEditAccess = async () => {
    if (!selectedPost) {
      return null;
    }

    setReadOnlyPostAccessState((currentState) =>
      currentState?.postId === selectedPost.id ? null : currentState,
    );

    try {
      const payload = await beginPostEditSession({
        post: selectedPost,
      });

      return {
        payload,
        post: selectedPost,
      };
    } catch (error) {
      const message = getProductionErrorMessage(error, "Could not open this post right now.");
      const handled = await handlePostEditCapabilityError({
        message,
        post: selectedPost,
        source: "acquire",
        status: getRequestErrorStatus(error),
      });

      if (!handled) {
        onSessionErrorRef.current?.(message);
      }

      return null;
    }
  };

  const closePostEditorSession = async () => {
    const postId = activePostEditSessionPostIdRef.current;

    if (postId) {
      await releasePostEditSession(postId);
    }

    setReadOnlyPostAccessState(null);
    setSelectedPostId(null);
    setPostContentView("list");
  };

  const acknowledgeLostPostAccess = () => {
    const currentLostAccessState = lostPostAccessState;

    if (currentLostAccessState) {
      restorePersistedPostDraft(currentLostAccessState.postId);
    }

    setLostPostAccessState(null);
    setReadOnlyPostAccessState(null);
    setSelectedPostId(null);
    setPostContentView("list");

    return currentLostAccessState;
  };

  const restorePendingStoredDraft = () => {
    const currentPendingRestore = pendingStoredDraftRestore;

    if (!currentPendingRestore) {
      return null;
    }

    setPendingStoredDraftRestore(null);
    restoringStoredDraftPostIdRef.current = currentPendingRestore.postId;

    if (selectedPostIdRef.current !== currentPendingRestore.postId) {
      setSelectedPostId(currentPendingRestore.postId);
    }

    if (postContentViewRef.current !== "editor") {
      setPostContentView("editor");
    }

    return currentPendingRestore;
  };

  const restorePendingLostPostDraft = () => {
    const currentPendingRestore = pendingLostPostDraftRestore;

    if (!currentPendingRestore) {
      return null;
    }

    setPendingLostPostDraftRestore(null);
    restoringLostPostDraftPostIdRef.current = currentPendingRestore.postId;

    if (selectedPostIdRef.current !== currentPendingRestore.postId) {
      setSelectedPostId(currentPendingRestore.postId);
    }

    if (postContentViewRef.current !== "editor") {
      setPostContentView("editor");
    }

    return currentPendingRestore;
  };

  const dismissPendingStoredDraft = async () => {
    const currentPendingRestore = pendingStoredDraftRestore;

    if (!currentPendingRestore) {
      return null;
    }

    setPendingStoredDraftRestore(null);
    await clearStoredPostDraftState(currentPendingRestore.postId);

    return currentPendingRestore;
  };

  const dismissPendingLostPostDraft = async () => {
    const currentPendingRestore = pendingLostPostDraftRestore;

    if (!currentPendingRestore) {
      return null;
    }

    promptedLostPostDraftPostIdRef.current = null;
    restoringLostPostDraftPostIdRef.current = null;
    setPendingLostPostDraftRestore(null);
    await autosaveStorage.clearLostPostDraftBackup(currentPendingRestore.postId);

    return currentPendingRestore;
  };

  const resolvePostEditConflict = async (post: ContentPost) => {
    try {
      const payload = await heartbeatPostEditSession(post);
      return handlePostEditSessionHeartbeatResult(post, payload);
    } catch (error) {
      await handlePostEditCapabilityError({
        message: getProductionErrorMessage(error, "Could not refresh editing access right now."),
        post,
        source: "heartbeat",
        status: getRequestErrorStatus(error),
      });
      return false;
    }
  };

  const hasUnsavedPostChangesNow = () => {
    return getCurrentPostAutosaveContext()?.hasUnsavedChanges ?? false;
  };

  const requestUnsavedChangesConfirmation = (
    action: () => void | Promise<void>,
    proceedLabel = "Discard and Continue",
    onCancel?: () => void,
  ) => {
    const decision = resolvePostNavigationGuard({
      hasPendingConfirmation: Boolean(pendingUnsavedChangesActionRef.current),
      hasUnsavedChanges: hasUnsavedPostChangesNow(),
    });

    if (decision === "allow-navigation") {
      void action();
      return;
    }

    if (decision === "block-navigation") {
      return;
    }

    pendingUnsavedChangesActionRef.current = action;
    pendingUnsavedChangesCancelActionRef.current = onCancel ?? null;
    setPendingUnsavedChangesAction({
      description: "You have unsaved changes in this post. Save before leaving or discard them and continue.",
      proceedLabel,
      title: "Unsaved changes",
    });
  };

  usePostEditorWindowLifecycleEffects({
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
  });

  usePostEditorSessionLifecycleEffects({
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
  });

  usePostEditorAutosaveEffects({
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
  });

  return {
    activePostEditSessionPostId,
    activePostEditSessionPostIdRef,
    acquiringPostEditSession,
    autoSlugPostIdsRef,
    browserNavigationBypassRef,
    clearStoredPostDraftState,
    currentBrowserUrlRef,
    dirtyPostIdsRef,
    draftPostsRef,
    beginPostEditSession,
    canEditCurrentPost,
    canEditCurrentPostRef,
    closePostEditorSession,
    dismissPendingLostPostDraft,
    dismissPendingPostTakeover,
    getDisplayedSelectedPostSlug,
    getEditingSessionLabel,
    handlePostEditCapabilityError,
    handlePostEditSessionHeartbeatResult,
    hasComparableUnsavedPostChanges,
    hasUnsavedPostChangesNow,
    heartbeatPostEditSession,
    isPersistingLocalAutosave,
    isEditingPostSlug,
    isEditingPostSlugRef,
    isRecoverablePostSessionError,
    isSavingRef,
    isPostSlugAutoManaged,
    loadingSelectedPost,
    lostPostAccessState,
    markPostDirty,
    markPostPersisted,
    pendingPostTakeover,
    pendingLostPostDraftRestore,
    pendingStoredDraftRestore,
    pendingUnsavedChangesAction,
    pendingUnsavedChangesCancelActionRef,
    pendingUnsavedChangesActionRef,
    persistedPostsRef,
    postEditCapability,
    postContentView,
    postContentViewRef,
    postSlugDraft,
    postSlugDraftRef,
    readOnlyPostAccessState,
    releasePostEditSession,
    requestUnsavedChangesConfirmation,
    restorePendingLostPostDraft,
    restorePendingStoredDraft,
    resolvePostEditConflict,
    restorePersistedPostDraft,
    acknowledgeLostPostAccess,
    dismissPendingStoredDraft,
    openPostEditorSession,
    retryCurrentPostEditAccess,
    selectedPost,
    selectedCollectionRef,
    selectedPostId,
    selectedPostIdRef,
    selectedPostLoadError,
    setActivePostEditSessionPostId,
    setAcquiringPostEditSession,
    setIsEditingPostSlug,
    setLoadingSelectedPost,
    setLostPostAccessState,
    setPendingPostTakeover,
    setPendingUnsavedChangesAction,
    setPostContentView,
    setPostSlugDraft,
    setSelectedPostId,
    setSelectedPostLoadError,
    syncLocalPostEditingSession,
    takeOverPendingPostEditing,
  };
};
