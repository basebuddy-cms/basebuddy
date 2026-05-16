import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import { cache } from "react";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  canForceProjectPostTakeover,
  type ProjectMemberAccess,
} from "@/lib/control-plane/permissions";
import { createControlPlaneServerClient } from "@/lib/control-plane/supabase-clients";

import { mapContentPostEditingSession } from "./server-support";
import {
  invalidateProjectRuntimeCacheGroups,
  projectRuntimeCacheGroups,
} from "./server-runtime-cache";

type ProjectPostEditSessionRow = {
  acquired?: boolean;
  active?: boolean;
  blocking_email?: string | null;
  blocking_name?: string | null;
  blocking_post_id?: string | null;
  blocking_post_title?: string | null;
  blocking_user_id?: string | null;
  editor_email?: string | null;
  editor_name?: string | null;
  last_heartbeat_at?: string;
  post_id?: string;
  post_title?: string | null;
  takeover?: boolean;
  user_id?: string;
  avatar_url?: string | null;
};

type ProjectPostAuthorAssignmentRow = {
  avatar_url: string | null;
  cms_author_id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
};

type ContentPostSessionContext = {
  connectionString: string | null;
  memberAccess: ProjectMemberAccess;
};

type ProjectPostEditSessionSnapshot = Omit<
  ReturnType<typeof mapContentPostEditingSession>,
  "isCurrentUser"
>;

const ensurePostEditContextReady = (context: ContentPostSessionContext) => {

  if (!context.connectionString) {
    throw new Error("This project needs a content connection before you can continue.");
  }
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

const buildBlockingSession = (row: ProjectPostEditSessionRow | null) =>
  row?.blocking_post_id && row?.blocking_user_id
    ? {
        avatarUrl: null,
        editorEmail: row.blocking_email ?? null,
        editorName: row.blocking_name ?? null,
        isCurrentUser: false,
        lastHeartbeatAt: new Date().toISOString(),
        postId: row.blocking_post_id,
        postTitle: row.blocking_post_title ?? null,
        userId: row.blocking_user_id,
      }
    : null;

const invalidateProjectPostPresenceSnapshot = (projectId: string) => {
  invalidateProjectRuntimeCacheGroups(projectId, [projectRuntimeCacheGroups.postsPresence]);
};

const loadProjectPostEditSessionSnapshot = cache(async (projectId: string) => {
  const supabase = await createControlPlaneServerClient();
  const { data, error } = await supabase.rpc("get_project_post_edit_sessions", {
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProductionErrorMessage(error, "Could not load post editing activity right now."));
  }

  const sessions = ((data ?? []) as ProjectPostEditSessionRow[])
    .filter((session) => session.post_id && session.user_id)
    .map((session) => {
      const mappedSession = mapContentPostEditingSession(session, "");

      return {
        avatarUrl: mappedSession.avatarUrl,
        editorEmail: mappedSession.editorEmail,
        editorName: mappedSession.editorName,
        lastHeartbeatAt: mappedSession.lastHeartbeatAt,
        postId: mappedSession.postId,
        postTitle: mappedSession.postTitle,
        userId: mappedSession.userId,
      } satisfies ProjectPostEditSessionSnapshot;
    });

  return new Map(sessions.map((session) => [session.postId, session]));
});

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

const loadProjectPostAuthorAssignments = cache(async (projectId: string) => {
  const supabase = await createControlPlaneServerClient();
  const { data, error } = await supabase.rpc("get_project_post_author_assignments", {
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProductionErrorMessage(error, "Could not load post author details right now."));
  }

  const assignments = ((data ?? []) as ProjectPostAuthorAssignmentRow[]).filter((assignment) =>
    Boolean(assignment.cms_author_id),
  );

  return new Map(assignments.map((assignment) => [assignment.cms_author_id, assignment]));
});

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

  const supabase = await createControlPlaneServerClient();
  const { data, error } = await supabase.rpc("heartbeat_project_post_edit_session", {
    p_post_id: postId,
    p_post_title: postTitle ?? null,
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProductionErrorMessage(error, "Could not verify post editing access right now."));
  }

  const row = ((Array.isArray(data) ? data[0] : data) ?? null) as ProjectPostEditSessionRow | null;

  if (row?.active) {
    invalidateProjectPostPresenceSnapshot(projectId);
    return;
  }

  if (!row?.blocking_user_id) {
    throw new Error("Post editing access expired.");
  }

  throw new Error(
    formatPostEditConflictMessage({
      editorEmail: row.blocking_email ?? null,
      editorName: row.blocking_name ?? null,
      postTitle: row.blocking_post_title ?? postTitle ?? null,
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

  const supabase = await createControlPlaneServerClient();
  const { data, error } = await supabase.rpc("acquire_project_post_edit_session", {
    p_force: force,
    p_post_id: postId,
    p_post_title: postTitle ?? null,
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProductionErrorMessage(error, "Could not open this post right now."));
  }

  const row = ((Array.isArray(data) ? data[0] : data) ?? null) as ProjectPostEditSessionRow | null;

  invalidateProjectPostPresenceSnapshot(projectId);

  return {
    acquired: Boolean(row?.acquired),
    blockingSession: buildBlockingSession(row),
    takeover: Boolean(row?.takeover),
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

  const supabase = await createControlPlaneServerClient();
  const { data, error } = await supabase.rpc("heartbeat_project_post_edit_session", {
    p_post_id: postId,
    p_post_title: postTitle ?? null,
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProductionErrorMessage(error, "Could not refresh editing access right now."));
  }

  const row = ((Array.isArray(data) ? data[0] : data) ?? null) as ProjectPostEditSessionRow | null;

  invalidateProjectPostPresenceSnapshot(projectId);

  return {
    active: Boolean(row?.active),
    blockingSession: buildBlockingSession(row),
  };
};

export const releaseContentPostEditSessionAccess = async ({
  postId,
  projectId,
}: {
  postId?: string | null;
  projectId: string;
}) => {
  const supabase = await createControlPlaneServerClient();
  const { error } = await supabase.rpc("release_project_post_edit_session", {
    p_post_id: postId ?? null,
    p_project_id: projectId,
  });

  if (error && !isControlPlaneSetupError(error)) {
    throw new Error(getProductionErrorMessage(error, "Could not leave this post right now."));
  }

  invalidateProjectPostPresenceSnapshot(projectId);
};
