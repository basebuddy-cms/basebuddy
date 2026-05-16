import type { ContentPost } from "@/lib/content-runtime/shared";

type ResolvedProjectEditorPostSave = {
  hasUnsavedChanges: boolean;
  post: ContentPost;
};

export const runProjectEditorPostSaveAction = async ({
  canEditCurrentPost,
  flushPostSave,
  getErrorMessage,
  getResolvedSelectedPostForSave,
  isExpectedSessionError,
  toastError,
  toastSuccess,
}: {
  canEditCurrentPost: boolean;
  flushPostSave: (post: ContentPost) => Promise<unknown>;
  getErrorMessage: (error: unknown, fallbackMessage: string) => string;
  getResolvedSelectedPostForSave: () => ResolvedProjectEditorPostSave | null;
  isExpectedSessionError: (error: unknown) => boolean;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
}) => {
  const resolvedSave = getResolvedSelectedPostForSave();

  if (!resolvedSave || !canEditCurrentPost || !resolvedSave.hasUnsavedChanges) {
    return;
  }

  try {
    await flushPostSave(resolvedSave.post);
    toastSuccess("Changes saved.");
  } catch (error) {
    if (isExpectedSessionError(error)) {
      return;
    }

    toastError(getErrorMessage(error, "Could not save the post right now."));
  }
};

export const runProjectEditorPostSaveAndContinueAction = async ({
  canEditCurrentPost,
  continuePendingUnsavedChangesAction,
  flushPostSave,
  getErrorMessage,
  getResolvedSelectedPostForSave,
  isExpectedSessionError,
  toastError,
}: {
  canEditCurrentPost: boolean;
  continuePendingUnsavedChangesAction: () => Promise<void>;
  flushPostSave: (post: ContentPost) => Promise<unknown>;
  getErrorMessage: (error: unknown, fallbackMessage: string) => string;
  getResolvedSelectedPostForSave: () => ResolvedProjectEditorPostSave | null;
  isExpectedSessionError: (error: unknown) => boolean;
  toastError: (message: string) => void;
}) => {
  try {
    if (!canEditCurrentPost) {
      return;
    }

    const resolvedSave = getResolvedSelectedPostForSave();

    if (resolvedSave?.hasUnsavedChanges) {
      await flushPostSave(resolvedSave.post);
    }

    await continuePendingUnsavedChangesAction();
  } catch (error) {
    if (isExpectedSessionError(error)) {
      return;
    }

    toastError(getErrorMessage(error, "Could not save the post right now."));
  }
};
