import { cache } from "react";

import { getConfigProjectPostAuthorAssignments } from "@/lib/basebuddy-config/projects";
import {
  canForceProjectPostTakeover,
  type ProjectMemberAccess,
} from "@/lib/control-plane/permissions";

import { mapContentPostEditingSession } from "./server-support";
import {
  invalidateProjectRuntimeCacheGroups,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";

type ContentPostSessionUser = {
  avatarUrl?: string | null;
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

type ContentPostSessionContext = {
  connectionString: string | null;
  memberAccess: ProjectMemberAccess;
  user: ContentPostSessionUser;
};

type ProjectPostEditSessionSnapshot = Omit<
  ReturnType<typeof mapContentPostEditingSession>,
  "isCurrentUser"
>;

type ProjectPostEditSessionRecord = ProjectPostEditSessionSnapshot & {
  lastHeartbeatMs: number;
};

const PROJECT_POST_EDIT_SESSION_STALE_MS = 20_000;
const projectPostEditSessionsByProjectId = new Map<
  string,
  Map<string, ProjectPostEditSessionRecord>
>();

const getProjectPostEditSessionStore = (projectId: string) => {
  const existingStore = projectPostEditSessionsByProjectId.get(projectId);

  if (existingStore) {
    return existingStore;
  }

  const nextStore = new Map<string, ProjectPostEditSessionRecord>();
  projectPostEditSessionsByProjectId.set(projectId, nextStore);
  return nextStore;
};

const ensurePostEditContextReady = (context: ContentPostSessionContext) => {
  if (!context.connectionString) {
    throw new Error("This project needs a working database connection before you can continue.");
  }

  if (!context.user.id?.trim()) {
    throw new Error("Authentication required.");
  }
};

const getContentPostSessionUserId = (context: ContentPostSessionContext) => {
  const userId = context.user.id?.trim();

  if (!userId) {
    throw new Error("Authentication required.");
  }

  return userId;
};

const formatPostEditConflictMessage = ({
  editorEmail,
  editorName,
  postTitle,
}: {
  editorEmail?: string | null;
  editorName?: string | null;
  postTitle?: string | null;
}) => {
  const editorLabel = editorName?.trim() || editorEmail?.trim() || "Another member";
  const titleLabel = postTitle?.trim() || "this post";
  return `${editorLabel} is already working on ${titleLabel}.`;
};

const cloneProjectPostEditSessionSnapshot = (
  session: ProjectPostEditSessionRecord,
): ProjectPostEditSessionSnapshot => ({
  avatarUrl: session.avatarUrl,
  editorEmail: session.editorEmail,
  editorName: session.editorName,
  lastHeartbeatAt: session.lastHeartbeatAt,
  postId: session.postId,
  postTitle: session.postTitle,
  userId: session.userId,
});

const buildBlockingSession = (
  session: ProjectPostEditSessionRecord | null | undefined,
) =>
  session
    ? {
        ...cloneProjectPostEditSessionSnapshot(session),
        isCurrentUser: false,
      }
    : null;

const cleanupStaleProjectPostEditSessions = (projectId: string) => {
  const store = projectPostEditSessionsByProjectId.get(projectId);

  if (!store?.size) {
    return;
  }

  const staleBefore = Date.now() - PROJECT_POST_EDIT_SESSION_STALE_MS;

  for (const [postId, session] of Array.from(store.entries())) {
    if (session.lastHeartbeatMs < staleBefore) {
      store.delete(postId);
    }
  }

  if (!store.size) {
    projectPostEditSessionsByProjectId.delete(projectId);
  }
};

const deleteProjectPostEditSessionByUserId = ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) => {
  const store = projectPostEditSessionsByProjectId.get(projectId);

  if (!store?.size) {
    return;
  }

  for (const [postId, session] of Array.from(store.entries())) {
    if (session.userId === userId) {
      store.delete(postId);
    }
  }

  if (!store.size) {
    projectPostEditSessionsByProjectId.delete(projectId);
  }
};

const createProjectPostEditSessionRecord = ({
  context,
  postId,
  postTitle,
}: {
  context: ContentPostSessionContext;
  postId: string;
  postTitle?: string | null;
}): ProjectPostEditSessionRecord => {
  const now = new Date();

  return {
    avatarUrl: context.user.avatarUrl ?? null,
    editorEmail: context.user.email ?? null,
    editorName: context.user.name?.trim() || context.user.email?.trim() || null,
    lastHeartbeatAt: now.toISOString(),
    lastHeartbeatMs: now.getTime(),
    postId,
    postTitle: postTitle?.trim() || null,
    userId: getContentPostSessionUserId(context),
  };
};

const upsertProjectPostEditSession = ({
  context,
  postId,
  postTitle,
  projectId,
}: {
  context: ContentPostSessionContext;
  postId: string;
  postTitle?: string | null;
  projectId: string;
}) => {
  deleteProjectPostEditSessionByUserId({
    projectId,
    userId: getContentPostSessionUserId(context),
  });

  const store = getProjectPostEditSessionStore(projectId);
  const session = createProjectPostEditSessionRecord({
    context,
    postId,
    postTitle,
  });

  store.set(postId, session);
  return session;
};

const invalidateProjectPostPresenceSnapshot = (projectId: string) => {
  invalidateProjectRuntimeCacheGroups(projectId, [projectRuntimeCacheGroups.postsPresence]);
};

const loadProjectPostEditSessionSnapshot = async (projectId: string) => {
  cleanupStaleProjectPostEditSessions(projectId);

  const store = projectPostEditSessionsByProjectId.get(projectId);
  const sessions = Array.from(store?.values() ?? [])
    .sort((left, right) => right.lastHeartbeatMs - left.lastHeartbeatMs)
    .map(cloneProjectPostEditSessionSnapshot);

  return new Map(sessions.map((session) => [session.postId, session]));
};

export const getProjectPostEditSessionSnapshot = async (projectId: string) =>
  loadProjectPostEditSessionSnapshot(projectId);

export const getProjectPostEditSessions = async (projectId: string, currentUserId: string) => {
  const snapshot = await loadProjectPostEditSessionSnapshot(projectId);

  return new Map(
    Array.from(snapshot.values()).map((session) => [
      session.postId,
      {
        ...session,
        isCurrentUser: session.userId === currentUserId,
      },
    ]),
  );
};

const loadProjectPostAuthorAssignments = cache((projectId: string) =>
  getConfigProjectPostAuthorAssignments(projectId),
);

export const getProjectPostAuthorAssignments = async (projectId: string) =>
  loadProjectPostAuthorAssignments(projectId);

export const assertContentPostEditSessionAccess = async ({
  context,
  postId,
  postTitle,
  projectId,
  verifyPostWriteAccess,
}: {
  context: ContentPostSessionContext;
  postId: string;
  postTitle?: string | null;
  projectId: string;
  verifyPostWriteAccess: () => Promise<void>;
}) => {
  ensurePostEditContextReady(context);
  await verifyPostWriteAccess();
  cleanupStaleProjectPostEditSessions(projectId);

  const store = getProjectPostEditSessionStore(projectId);
  const currentSession = store.get(postId);

  if (currentSession?.userId === getContentPostSessionUserId(context)) {
    store.set(postId, createProjectPostEditSessionRecord({ context, postId, postTitle }));
    invalidateProjectPostPresenceSnapshot(projectId);
    return;
  }

  if (!currentSession) {
    upsertProjectPostEditSession({
      context,
      postId,
      postTitle,
      projectId,
    });
    invalidateProjectPostPresenceSnapshot(projectId);
    return;
  }

  throw new Error(
    formatPostEditConflictMessage({
      editorEmail: currentSession.editorEmail,
      editorName: currentSession.editorName,
      postTitle: currentSession.postTitle ?? postTitle ?? null,
    }),
  );
};

export const acquireContentPostEditSessionAccess = async ({
  context,
  force = false,
  postId,
  postTitle,
  projectId,
  verifyPostWriteAccess,
}: {
  context: ContentPostSessionContext;
  force?: boolean;
  postId: string;
  postTitle?: string | null;
  projectId: string;
  verifyPostWriteAccess: () => Promise<void>;
}) => {
  ensurePostEditContextReady(context);
  await verifyPostWriteAccess();

  if (force && !canForceProjectPostTakeover(context.memberAccess)) {
    throw new Error("Only owners, admins, and editors can take over an active post editing session.");
  }

  cleanupStaleProjectPostEditSessions(projectId);

  const store = getProjectPostEditSessionStore(projectId);
  const existingSession = store.get(postId);

  if (existingSession && existingSession.userId !== getContentPostSessionUserId(context) && !force) {
    return {
      acquired: false,
      blockingSession: buildBlockingSession(existingSession),
      takeover: false,
    };
  }

  const takeover = Boolean(existingSession && existingSession.userId !== getContentPostSessionUserId(context));
  const blockingSession = takeover ? buildBlockingSession(existingSession) : null;

  if (takeover) {
    store.delete(postId);
  }

  upsertProjectPostEditSession({
    context,
    postId,
    postTitle,
    projectId,
  });
  invalidateProjectPostPresenceSnapshot(projectId);

  return {
    acquired: true,
    blockingSession,
    takeover,
  };
};

export const heartbeatContentPostEditSessionAccess = async ({
  context,
  postId,
  postTitle,
  projectId,
  verifyPostWriteAccess,
}: {
  context: ContentPostSessionContext;
  postId: string;
  postTitle?: string | null;
  projectId: string;
  verifyPostWriteAccess: () => Promise<void>;
}) => {
  ensurePostEditContextReady(context);
  await verifyPostWriteAccess();
  cleanupStaleProjectPostEditSessions(projectId);

  const store = getProjectPostEditSessionStore(projectId);
  const existingSession = store.get(postId);

  if (existingSession?.userId === getContentPostSessionUserId(context)) {
    store.set(postId, createProjectPostEditSessionRecord({ context, postId, postTitle }));
    invalidateProjectPostPresenceSnapshot(projectId);

    return {
      active: true,
      blockingSession: null,
    };
  }

  if (existingSession) {
    invalidateProjectPostPresenceSnapshot(projectId);

    return {
      active: false,
      blockingSession: buildBlockingSession(existingSession),
    };
  }

  upsertProjectPostEditSession({
    context,
    postId,
    postTitle,
    projectId,
  });
  invalidateProjectPostPresenceSnapshot(projectId);

  return {
    active: true,
    blockingSession: null,
  };
};

export const releaseContentPostEditSessionAccess = async ({
  context,
  postId,
  projectId,
}: {
  context: ContentPostSessionContext;
  postId?: string | null;
  projectId: string;
}) => {
  const store = projectPostEditSessionsByProjectId.get(projectId);

  if (!store?.size) {
    return;
  }

  for (const [sessionPostId, session] of Array.from(store.entries())) {
    if (session.userId === getContentPostSessionUserId(context) && (!postId || sessionPostId === postId)) {
      store.delete(sessionPostId);
    }
  }

  if (!store.size) {
    projectPostEditSessionsByProjectId.delete(projectId);
  }

  invalidateProjectPostPresenceSnapshot(projectId);
};
