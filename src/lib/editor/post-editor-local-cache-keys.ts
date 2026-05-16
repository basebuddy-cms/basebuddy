const POST_EDITOR_STORAGE_PREFIX = "content-runtime";
export const POST_EDITOR_PREVIEW_STORAGE_PREFIX = `${POST_EDITOR_STORAGE_PREFIX}:post-preview:`;

const getProjectScopedPostEditorStoragePrefix = (projectId: string) =>
  `${POST_EDITOR_STORAGE_PREFIX}:${projectId}`;

export const getPostEditorDraftStorageKey = (projectId: string, postId: string) =>
  `${getProjectScopedPostEditorStoragePrefix(projectId)}:post-draft:${postId}`;

export const getPostEditorDraftPayloadStorageKey = (projectId: string, postId: string) =>
  `${getProjectScopedPostEditorStoragePrefix(projectId)}:post-draft-payload:${postId}`;

export const getPostEditorDraftSessionStorageKey = (projectId: string) =>
  `${getProjectScopedPostEditorStoragePrefix(projectId)}:post-draft-session`;

export const getPostEditorTakeoverBackupStorageKey = (projectId: string, postId: string) =>
  `${getProjectScopedPostEditorStoragePrefix(projectId)}:post-takeover-backup:${postId}`;

export const getPostEditorTakeoverBackupPayloadStorageKey = (projectId: string, postId: string) =>
  `${getProjectScopedPostEditorStoragePrefix(projectId)}:post-takeover-backup-payload:${postId}`;

export const getPostEditorFocusKeywordStorageKey = (projectId: string, postId: string) =>
  `${getProjectScopedPostEditorStoragePrefix(projectId)}:seo-focus-keyword:${postId}`;

export const getPostEditorSeoFocusKeywordStorageKey = getPostEditorFocusKeywordStorageKey;

export const getPostEditorPreviewStoragePrefix = () => POST_EDITOR_PREVIEW_STORAGE_PREFIX;

export const getPostEditorPreviewStorageKey = (token: string) =>
  `${POST_EDITOR_PREVIEW_STORAGE_PREFIX}${token}`;

export const createPostEditorAutosaveStorageKeys = (projectId: string) => ({
  lostPostDraftBackup: (postId: string) => getPostEditorTakeoverBackupStorageKey(projectId, postId),
  lostPostDraftBackupPayload: (postId: string) =>
    getPostEditorTakeoverBackupPayloadStorageKey(projectId, postId),
  storedPostDraft: (postId: string) => getPostEditorDraftStorageKey(projectId, postId),
  storedPostDraftPayload: (postId: string) => getPostEditorDraftPayloadStorageKey(projectId, postId),
  storedPostDraftSession: () => getPostEditorDraftSessionStorageKey(projectId),
});
