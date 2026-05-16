"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  completeContentRuntimeDirectUploads,
  prepareContentRuntimeDirectUploads,
} from "@/lib/content-runtime/client-upload-api";
import { uploadPreparedContentRuntimeFile } from "@/lib/content-runtime/client-direct-upload";
import type { ContentFileItem, ContentFilesLibrary } from "@/lib/content-runtime/shared";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { MAX_FILE_UPLOAD_BYTES, validateFileUpload } from "@/lib/security/upload-validation";
import { ProjectFilesManagerContent } from "@/components/editor/project-files-manager/content";
import { ProjectFilesManagerDialogs } from "@/components/editor/project-files-manager/dialogs";
import { ProjectFilesManagerSidebar } from "@/components/editor/project-files-manager/sidebar";
import { ProjectFilesManagerSkeleton } from "@/components/editor/project-files-manager/skeleton";
import {
  getProjectEditorFilesLibraryQueryOptions,
  projectEditorQueryFamilies,
  projectEditorQueryKeys,
} from "@/components/editor/project-editor/queries";
import { useProjectEditorDebouncedValue } from "@/components/editor/project-editor/use-debounced-value";
import { mergeProjectEditorManagedStorageFolderOptions } from "@/components/editor/project-editor/managed-storage-cache";
import { loadProjectEditorReadThroughQuery } from "@/components/editor/project-editor/read-through-query";
import {
  clearCachedFilesPayloads,
  filesCacheExpiryBufferMs,
  getFilesErrorMessage,
  getParentFolderPath,
  readCachedFilesPayload,
  rebaseFolderPath,
  ROOT_FOLDER_VALUE,
  writeCachedFilesPayload,
} from "@/components/editor/project-files-manager/support";

type ProjectFilesManagerProps = {
  initialPath?: string;
  initialSearch?: string;
  onFilesChanged?: () => Promise<void> | void;
  onLoadingStateChange?: (isLoading: boolean) => void;
  onStateChange?: (state: { currentPath: string; searchQuery: string }) => void;
  projectId: string;
};

export function ProjectFilesManager({
  initialPath = "",
  initialSearch = "",
  onFilesChanged,
  onLoadingStateChange,
  onStateChange,
  projectId,
}: ProjectFilesManagerProps) {
  const queryClient = useQueryClient();
  const [filesLibrary, setFilesLibrary] = useState<ContentFilesLibrary | null>(null);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const deferredSearch = useProjectEditorDebouncedValue(searchQuery, 300);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [movingFilePath, setMovingFilePath] = useState<string | null>(null);
  const [movingFolderPath, setMovingFolderPath] = useState<string | null>(null);
  const [deletingFilePath, setDeletingFilePath] = useState<string | null>(null);
  const [deletingFolderPath, setDeletingFolderPath] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveDialogFile, setMoveDialogFile] = useState<ContentFileItem | null>(null);
  const [moveDestinationPath, setMoveDestinationPath] = useState(ROOT_FOLDER_VALUE);
  const [moveDialogFolderPath, setMoveDialogFolderPath] = useState<string | null>(null);
  const [moveFolderDestinationPath, setMoveFolderDestinationPath] = useState(ROOT_FOLDER_VALUE);
  const [deleteFileTarget, setDeleteFileTarget] = useState<ContentFileItem | null>(null);
  const [deleteFolderTargetPath, setDeleteFolderTargetPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const latestLoadRequestRef = useRef(0);
  const skipNextPathLoadRef = useRef(false);

  const applyFilesPayload = (
    payload: ContentFilesLibrary,
    path: string,
    search: string,
    options?: { persist?: boolean },
  ) => {
    setFilesLibrary(payload);
    setHasLoadedSnapshot(true);

    if (options?.persist !== false) {
      writeCachedFilesPayload(projectId, path, search, payload);
    }
  };

  const loadFiles = async (path = currentPath, search = deferredSearch, options?: { force?: boolean }) => {
    const normalizedPath = path;
    const normalizedSearch = search.trim();
    const force = options?.force ?? false;
    await loadProjectEditorReadThroughQuery({
      applyPayload: (payload, nextOptions) =>
        applyFilesPayload(payload, normalizedPath, normalizedSearch, nextOptions),
      fetchFreshPayload: () =>
        queryClient.fetchQuery({
          ...getProjectEditorFilesLibraryQueryOptions({
            includeFolderOptions: false,
            path: normalizedPath,
            projectId,
            search: normalizedSearch,
          }),
          ...(force ? { staleTime: 0 } : {}),
        }),
      force,
      getCachedPayload: () => readCachedFilesPayload(projectId, normalizedPath, normalizedSearch),
      getErrorMessage: (error) =>
        getProductionErrorMessage(error, "Could not load the files library right now."),
      getQueryPayload: () =>
        queryClient.getQueryData<ContentFilesLibrary>(
          projectEditorQueryKeys.filesLibrary({
            includeFolderOptions: false,
            path: normalizedPath,
            projectId,
            search: normalizedSearch,
          }),
        ),
      latestRequestRef: latestLoadRequestRef,
      setErrorMessage,
      setLoading,
      setRefreshing,
    });
  };

  useEffect(() => {
    if (skipNextPathLoadRef.current) {
      skipNextPathLoadRef.current = false;
      return;
    }

    void loadFiles(currentPath, deferredSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentPath, deferredSearch, queryClient]);

  useEffect(() => {
    const expiresAt = Date.parse(filesLibrary?.urlExpiresAt ?? "");

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    const refreshDelay = Math.max(0, expiresAt - Date.now() - filesCacheExpiryBufferMs);
    const timeoutId = window.setTimeout(() => {
      void loadFiles(currentPath, deferredSearch, { force: true });
    }, refreshDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, deferredSearch, filesLibrary?.urlExpiresAt, projectId, queryClient]);

  useEffect(() => {
    onLoadingStateChange?.(loading || refreshing);

    return () => {
      onLoadingStateChange?.(false);
    };
  }, [loading, onLoadingStateChange, refreshing]);

  useEffect(() => {
    onStateChange?.({ currentPath, searchQuery });
  }, [currentPath, onStateChange, searchQuery]);

  const clearManagedStorageCache = () => {
    clearCachedFilesPayloads(projectId);
    queryClient.removeQueries({
      queryKey: projectEditorQueryFamilies.filesLibraries(projectId),
    });
  };

  const ensureFolderOptionsLoaded = async () => {
    if (filesLibrary?.folderOptions.length) {
      return;
    }

    try {
      const payload = await queryClient.fetchQuery({
        ...getProjectEditorFilesLibraryQueryOptions({
          includeFolderOptions: true,
          path: currentPath,
          projectId,
          search: deferredSearch.trim(),
        }),
        staleTime: 0,
      });

      setFilesLibrary((currentPayload) => {
        return mergeProjectEditorManagedStorageFolderOptions({
          currentPayload,
          nextPayload: payload,
          persistPayload: (nextPayload) =>
            writeCachedFilesPayload(projectId, nextPayload.currentPath, nextPayload.search, nextPayload),
        });
      });
    } catch {
      return;
    }
  };

  const handleOpenFileMoveDialog = (file: ContentFileItem | null) => {
    setMoveDialogFile(file);

    if (file) {
      void ensureFolderOptionsLoaded();
    }
  };

  const handleOpenFolderMoveDialog = (folderPath: string | null) => {
    setMoveDialogFolderPath(folderPath);

    if (folderPath) {
      void ensureFolderOptionsLoaded();
    }
  };

  const uploadFiles = async (files: File[]) => {
    const canManage = filesLibrary?.canManage ?? false;

    if (!canManage) {
      return;
    }

    if (!files.length) {
      toast.error("Choose files to upload.");
      return;
    }

    setUploading(true);

    try {
      const validatedFiles = await Promise.all(
        files.map(async (file) => ({
          file,
          validation: await validateFileUpload({
            file,
            label: file.name || "File upload",
            maxBytes: MAX_FILE_UPLOAD_BYTES,
          }),
        })),
      );
      const uploads = await prepareContentRuntimeDirectUploads({
        endpoint: `/api/projects/${projectId}/files`,
        files: validatedFiles.map(({ file, validation }) => ({
          contentType: validation.contentType,
          name: file.name,
          size: file.size,
        })),
        path: currentPath,
      });

      if (uploads.length !== validatedFiles.length) {
        throw new Error("Could not prepare those uploads right now.");
      }

      await Promise.all(
        uploads.map((upload, index) =>
          uploadPreparedContentRuntimeFile({
            file: validatedFiles[index]!.file,
            upload,
          }),
        ),
      );
      await completeContentRuntimeDirectUploads({
        endpoint: `/api/projects/${projectId}/files`,
        objectPaths: uploads.map((upload) => upload.objectPath),
      });

      clearManagedStorageCache();
      await loadFiles(currentPath, deferredSearch, { force: true });
      await onFilesChanged?.();
      toast.success(files.length === 1 ? "File uploaded." : "Files uploaded.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not upload those files right now."));
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!filesLibrary?.canManage || !newFolderName.trim()) {
      return;
    }

    setCreatingFolder(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        body: JSON.stringify({
          action: "create_folder",
          folderName: newFolderName.trim(),
          parentPath: currentPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(await getFilesErrorMessage(response));
      }

      setNewFolderName("");
      clearManagedStorageCache();
      await loadFiles(currentPath, deferredSearch, { force: true });
      await onFilesChanged?.();
      toast.success("Folder created.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not create that folder right now."));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleMoveFile = async () => {
    if (!moveDialogFile) {
      return;
    }

    setMovingFilePath(moveDialogFile.objectPath);

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        body: JSON.stringify({
          action: "move_file",
          destinationPath: moveDestinationPath === ROOT_FOLDER_VALUE ? "" : moveDestinationPath,
          objectPath: moveDialogFile.objectPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await getFilesErrorMessage(response));
      }

      const nextPath = moveDestinationPath === ROOT_FOLDER_VALUE ? "" : moveDestinationPath;
      const movedFileName = moveDialogFile.fileName;

      setMoveDialogFile(null);
      clearManagedStorageCache();
      await loadFiles(currentPath, deferredSearch, { force: true });
      await onFilesChanged?.();
      toast.success(`${movedFileName} moved to ${nextPath || "Home"}.`);
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not move that file right now."));
    } finally {
      setMovingFilePath(null);
    }
  };

  const handleMoveFolder = async () => {
    if (!moveDialogFolderPath) {
      return;
    }

    setMovingFolderPath(moveDialogFolderPath);

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        body: JSON.stringify({
          action: "move_folder",
          destinationPath: moveFolderDestinationPath === ROOT_FOLDER_VALUE ? "" : moveFolderDestinationPath,
          folderPath: moveDialogFolderPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await getFilesErrorMessage(response));
      }

      const payload = (await response.json()) as { folderPath?: string };
      const nextFolderPath = payload.folderPath ?? moveDialogFolderPath;
      const nextCurrentPath =
        currentPath === moveDialogFolderPath || currentPath.startsWith(`${moveDialogFolderPath}/`)
          ? rebaseFolderPath(currentPath, moveDialogFolderPath, nextFolderPath)
          : currentPath;

      setMoveDialogFolderPath(null);
      setMoveFolderDestinationPath(ROOT_FOLDER_VALUE);
      clearManagedStorageCache();

      if (nextCurrentPath !== currentPath) {
        skipNextPathLoadRef.current = true;
        setCurrentPath(nextCurrentPath);
      }

      await loadFiles(nextCurrentPath, deferredSearch, { force: true });
      await onFilesChanged?.();
      toast.success("Folder moved.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not move that folder right now."));
    } finally {
      setMovingFolderPath(null);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteFileTarget) {
      return;
    }

    setDeletingFilePath(deleteFileTarget.objectPath);

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        body: JSON.stringify({
          action: "delete_file",
          objectPath: deleteFileTarget.objectPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getFilesErrorMessage(response));
      }

      setDeleteFileTarget(null);
      clearManagedStorageCache();
      await loadFiles(currentPath, deferredSearch, { force: true });
      await onFilesChanged?.();
      toast.success("File deleted.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not delete that file right now."));
    } finally {
      setDeletingFilePath(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTargetPath) {
      return;
    }

    setDeletingFolderPath(deleteFolderTargetPath);

    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        body: JSON.stringify({
          action: "delete_folder",
          folderPath: deleteFolderTargetPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getFilesErrorMessage(response));
      }

      setDeleteFolderTargetPath(null);
      clearManagedStorageCache();
      const nextCurrentPath =
        currentPath === deleteFolderTargetPath || currentPath.startsWith(`${deleteFolderTargetPath}/`)
          ? getParentFolderPath(deleteFolderTargetPath)
          : currentPath;

      if (nextCurrentPath !== currentPath) {
        skipNextPathLoadRef.current = true;
        setCurrentPath(nextCurrentPath);
      }

      await loadFiles(nextCurrentPath, deferredSearch, { force: true });
      await onFilesChanged?.();
      toast.success("Folder deleted.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not delete that folder right now."));
    } finally {
      setDeletingFolderPath(null);
    }
  };

  if (loading && !hasLoadedSnapshot) {
    return <ProjectFilesManagerSkeleton />;
  }

  return (
    <div
      className={[
        "flex h-full min-h-0",
        isDragActive ? "bg-primary/5 ring-2 ring-inset ring-primary/40" : "",
      ].join(" ")}
      onDragEnter={(event) => {
        if (!filesLibrary?.canManage) {
          return;
        }

        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!filesLibrary?.canManage) {
          return;
        }

        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

        if (dragDepthRef.current === 0) {
          setIsDragActive(false);
        }
      }}
      onDragOver={(event) => {
        if (!filesLibrary?.canManage) {
          return;
        }

        event.preventDefault();
      }}
      onDrop={(event) => {
        if (!filesLibrary?.canManage) {
          return;
        }

        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDragActive(false);

        const droppedFiles = Array.from(event.dataTransfer.files ?? []);

        if (droppedFiles.length) {
          void uploadFiles(droppedFiles);
        }
      }}
    >
      <ProjectFilesManagerContent
        canManage={filesLibrary?.canManage ?? false}
        deferredSearch={deferredSearch}
        errorMessage={errorMessage}
        filesLibrary={filesLibrary}
        onDeleteFileRequest={setDeleteFileTarget}
        onDeleteFolderRequest={setDeleteFolderTargetPath}
        onMoveDestinationPathChange={setMoveDestinationPath}
        onMoveDialogFileChange={handleOpenFileMoveDialog}
        onMoveDialogFolderPathChange={handleOpenFolderMoveDialog}
        onMoveFolderDestinationPathChange={setMoveFolderDestinationPath}
        onPathChange={setCurrentPath}
        onSearchQueryChange={setSearchQuery}
        onUploadRequest={() => fileInputRef.current?.click()}
        searchQuery={searchQuery}
        uploading={uploading}
      />

      <ProjectFilesManagerSidebar
        canManage={filesLibrary?.canManage ?? false}
        canManageCurrentFolder={Boolean(currentPath)}
        creatingFolder={creatingFolder}
        currentPath={currentPath}
        deletingFolderPath={deletingFolderPath}
        files={filesLibrary}
        movingFolderPath={movingFolderPath}
        newFolderName={newFolderName}
        onCreateFolder={() => void handleCreateFolder()}
        onDeleteCurrentFolder={() => setDeleteFolderTargetPath(currentPath)}
        onMoveCurrentFolder={() => {
          handleOpenFolderMoveDialog(currentPath);
          setMoveFolderDestinationPath(getParentFolderPath(currentPath) || ROOT_FOLDER_VALUE);
        }}
        onNewFolderNameChange={setNewFolderName}
        onUploadRequest={() => fileInputRef.current?.click()}
        uploading={uploading}
      />

      <ProjectFilesManagerDialogs
        deleteFileTarget={deleteFileTarget}
        deleteFolderTargetPath={deleteFolderTargetPath}
        deletingFilePath={deletingFilePath}
        deletingFolderPath={deletingFolderPath}
        folderMoveOptions={(filesLibrary?.folderOptions ?? []).filter((path) => path !== currentPath)}
        folderOptions={filesLibrary?.folderOptions ?? []}
        moveDestinationPath={moveDestinationPath}
        moveDialogFile={moveDialogFile}
        moveDialogFolderPath={moveDialogFolderPath}
        moveFolderDestinationPath={moveFolderDestinationPath}
        movingFilePath={movingFilePath}
        movingFolderPath={movingFolderPath}
        onConfirmDeleteFile={() => void handleDeleteFile()}
        onConfirmDeleteFolder={() => void handleDeleteFolder()}
        onConfirmMoveFile={() => void handleMoveFile()}
        onConfirmMoveFolder={() => void handleMoveFolder()}
        onMoveDestinationPathChange={setMoveDestinationPath}
        onMoveDialogFileChange={handleOpenFileMoveDialog}
        onMoveDialogFolderPathChange={handleOpenFolderMoveDialog}
        onMoveFolderDestinationPathChange={setMoveFolderDestinationPath}
        onRequestDeleteFileChange={setDeleteFileTarget}
        onRequestDeleteFolderChange={setDeleteFolderTargetPath}
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          const selectedFiles = Array.from(event.target.files ?? []);

          if (selectedFiles.length) {
            void uploadFiles(selectedFiles);
          }

          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
