"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import {
  completeContentRuntimeDirectUploads,
  prepareContentRuntimeDirectUploads,
} from "@/lib/content-runtime/client-upload-api";
import { uploadPreparedContentRuntimeFile } from "@/lib/content-runtime/client-direct-upload";
import type { ContentMediaImage, ContentMediaLibrary } from "@/lib/content-runtime/shared";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import { MAX_MEDIA_UPLOAD_BYTES, validateImageUploadFile } from "@/lib/security/upload-validation";
import { ProjectMediaManagerContent } from "@/components/editor/project-media-manager/content";
import { ProjectMediaManagerDialogs } from "@/components/editor/project-media-manager/dialogs";
import { ProjectMediaManagerSkeleton } from "@/components/editor/project-media-manager/skeleton";
import { ProjectMediaManagerSidebar } from "@/components/editor/project-media-manager/sidebar";
import {
  getProjectEditorMediaLibraryQueryOptions,
  projectEditorQueryFamilies,
  projectEditorQueryKeys,
} from "@/components/editor/project-editor/queries";
import { useProjectEditorDebouncedValue } from "@/components/editor/project-editor/use-debounced-value";
import { mergeProjectEditorManagedStorageFolderOptions } from "@/components/editor/project-editor/managed-storage-cache";
import { loadProjectEditorReadThroughQuery } from "@/components/editor/project-editor/read-through-query";
import {
  clearCachedMediaPayloads,
  getMediaErrorMessage,
  getParentFolderPath,
  mediaCacheExpiryBufferMs,
  readCachedMediaPayload,
  rebaseFolderPath,
  ROOT_FOLDER_VALUE,
  writeCachedMediaPayload,
} from "@/components/editor/project-media-manager/support";

type ProjectMediaManagerProps = {
  initialPath?: string;
  initialSearch?: string;
  onMediaChanged?: () => Promise<void> | void;
  onLoadingStateChange?: (isLoading: boolean) => void;
  onStateChange?: (state: { currentPath: string; searchQuery: string }) => void;
  projectId: string;
};

export function ProjectMediaManager({
  initialPath = "",
  initialSearch = "",
  onLoadingStateChange,
  onMediaChanged,
  onStateChange,
  projectId,
}: ProjectMediaManagerProps) {
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<ContentMediaLibrary | null>(null);
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
  const [movingImageId, setMovingImageId] = useState<string | null>(null);
  const [movingFolderPath, setMovingFolderPath] = useState<string | null>(null);
  const [deletingImagePath, setDeletingImagePath] = useState<string | null>(null);
  const [deletingFolderPath, setDeletingFolderPath] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveDialogImage, setMoveDialogImage] = useState<ContentMediaImage | null>(null);
  const [moveDestinationPath, setMoveDestinationPath] = useState(ROOT_FOLDER_VALUE);
  const [moveDialogFolderPath, setMoveDialogFolderPath] = useState<string | null>(null);
  const [moveFolderDestinationPath, setMoveFolderDestinationPath] = useState(ROOT_FOLDER_VALUE);
  const [deleteImageTarget, setDeleteImageTarget] = useState<ContentMediaImage | null>(null);
  const [deleteFolderTargetPath, setDeleteFolderTargetPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const latestLoadRequestRef = useRef(0);

  const applyMediaPayload = (
    payload: ContentMediaLibrary,
    path: string,
    search: string,
    options?: { persist?: boolean },
  ) => {
    setMedia(payload);
    setHasLoadedSnapshot(true);

    if (options?.persist !== false) {
      writeCachedMediaPayload(projectId, path, search, payload);
    }
  };

  const loadMedia = async (path = currentPath, search = deferredSearch, options?: { force?: boolean }) => {
    const normalizedPath = path;
    const normalizedSearch = search.trim();
    const force = options?.force ?? false;
    await loadProjectEditorReadThroughQuery({
      applyPayload: (payload, nextOptions) =>
        applyMediaPayload(payload, normalizedPath, normalizedSearch, nextOptions),
      fetchFreshPayload: () =>
        queryClient.fetchQuery({
          ...getProjectEditorMediaLibraryQueryOptions({
            includeFolderOptions: false,
            path: normalizedPath,
            projectId,
            search: normalizedSearch,
          }),
          ...(force ? { staleTime: 0 } : {}),
        }),
      force,
      getCachedPayload: () => readCachedMediaPayload(projectId, normalizedPath, normalizedSearch),
      getErrorMessage: (error) =>
        getProductionErrorMessage(error, "Could not load the media library right now."),
      getQueryPayload: () =>
        queryClient.getQueryData<ContentMediaLibrary>(
          projectEditorQueryKeys.mediaLibrary({
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
    void loadMedia(currentPath, deferredSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentPath, deferredSearch, queryClient]);

  useEffect(() => {
    const expiresAt = Date.parse(media?.urlExpiresAt ?? "");

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    const refreshDelay = Math.max(0, expiresAt - Date.now() - mediaCacheExpiryBufferMs);
    const timeoutId = window.setTimeout(() => {
      void loadMedia(currentPath, deferredSearch, { force: true });
    }, refreshDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, deferredSearch, media?.urlExpiresAt, projectId, queryClient]);

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
    clearCachedMediaPayloads(projectId);
    queryClient.removeQueries({
      queryKey: projectEditorQueryFamilies.mediaLibraries(projectId),
    });
  };

  const ensureFolderOptionsLoaded = async () => {
    if (media?.folderOptions.length) {
      return;
    }

    try {
      const payload = await queryClient.fetchQuery({
        ...getProjectEditorMediaLibraryQueryOptions({
          includeFolderOptions: true,
          path: currentPath,
          projectId,
          search: deferredSearch.trim(),
        }),
        staleTime: 0,
      });

      setMedia((currentPayload) => {
        return mergeProjectEditorManagedStorageFolderOptions({
          currentPayload,
          nextPayload: payload,
          persistPayload: (nextPayload) =>
            writeCachedMediaPayload(projectId, nextPayload.currentPath, nextPayload.search, nextPayload),
        });
      });
    } catch {
      return;
    }
  };

  const handleOpenImageMoveDialog = (image: ContentMediaImage | null) => {
    setMoveDialogImage(image);

    if (image) {
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
    const canManage = media?.canManage ?? false;

    if (!canManage) {
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (!imageFiles.length) {
      toast.error("Choose image files to upload.");
      return;
    }

    setUploading(true);

    try {
      const validatedFiles = await Promise.all(
        imageFiles.map(async (file) => ({
          file,
          validation: await validateImageUploadFile({
            file,
            label: file.name || "Image upload",
            maxBytes: MAX_MEDIA_UPLOAD_BYTES,
          }),
        })),
      );
      const uploads = await prepareContentRuntimeDirectUploads({
        endpoint: `/api/projects/${projectId}/media`,
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
        endpoint: `/api/projects/${projectId}/media`,
        objectPaths: uploads.map((upload) => upload.objectPath),
      });

      clearManagedStorageCache();
      await loadMedia(currentPath, deferredSearch, { force: true });
      await onMediaChanged?.();
      toast.success(imageFiles.length === 1 ? "Image uploaded." : "Images uploaded.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not upload those images right now."));
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!media?.canManage || !newFolderName.trim()) {
      return;
    }

    setCreatingFolder(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/media`, {
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
        throw new Error(await getMediaErrorMessage(response));
      }

      setNewFolderName("");
      clearManagedStorageCache();
      await loadMedia(currentPath, deferredSearch, { force: true });
      await onMediaChanged?.();
      toast.success("Folder created.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not create that folder right now."));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleMoveImage = async () => {
    if (!moveDialogImage) {
      return;
    }

    setMovingImageId(moveDialogImage.id);

    try {
      const response = await fetch(`/api/projects/${projectId}/media`, {
        body: JSON.stringify({
          action: "move_image",
          destinationPath: moveDestinationPath === ROOT_FOLDER_VALUE ? "" : moveDestinationPath,
          objectPath: moveDialogImage.objectPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await getMediaErrorMessage(response));
      }

      setMoveDialogImage(null);
      clearManagedStorageCache();
      await loadMedia(currentPath, deferredSearch, { force: true });
      await onMediaChanged?.();
      toast.success("Image moved.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not move that image right now."));
    } finally {
      setMovingImageId(null);
    }
  };

  const handleMoveFolder = async () => {
    if (!moveDialogFolderPath) {
      return;
    }

    setMovingFolderPath(moveDialogFolderPath);

    try {
      const response = await fetch(`/api/projects/${projectId}/media`, {
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
        throw new Error(await getMediaErrorMessage(response));
      }

      const payload = (await response.json()) as { folderPath?: string };
      const nextFolderPath = payload.folderPath ?? moveDialogFolderPath;
      const nextCurrentPath = rebaseFolderPath(currentPath, moveDialogFolderPath, nextFolderPath);

      clearManagedStorageCache();
      setMoveDialogFolderPath(null);

      if (nextCurrentPath !== currentPath) {
        setCurrentPath(nextCurrentPath);
      } else {
        await loadMedia(currentPath, deferredSearch, { force: true });
      }

      await onMediaChanged?.();
      toast.success("Folder moved.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not move that folder right now."));
    } finally {
      setMovingFolderPath(null);
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageTarget) {
      return;
    }

    setDeletingImagePath(deleteImageTarget.objectPath);

    try {
      const response = await fetch(`/api/projects/${projectId}/media`, {
        body: JSON.stringify({
          action: "delete_image",
          objectPath: deleteImageTarget.objectPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await getMediaErrorMessage(response));
      }

      setDeleteImageTarget(null);
      clearManagedStorageCache();
      await loadMedia(currentPath, deferredSearch, { force: true });
      await onMediaChanged?.();
      toast.success("Image deleted.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not delete that image right now."));
    } finally {
      setDeletingImagePath(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTargetPath) {
      return;
    }

    setDeletingFolderPath(deleteFolderTargetPath);

    try {
      const response = await fetch(`/api/projects/${projectId}/media`, {
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
        throw new Error(await getMediaErrorMessage(response));
      }

      const nextCurrentPath =
        currentPath === deleteFolderTargetPath || currentPath.startsWith(`${deleteFolderTargetPath}/`)
          ? getParentFolderPath(deleteFolderTargetPath)
          : currentPath;

      clearManagedStorageCache();
      setDeleteFolderTargetPath(null);

      if (nextCurrentPath !== currentPath) {
        setCurrentPath(nextCurrentPath);
      } else {
        await loadMedia(currentPath, deferredSearch, { force: true });
      }

      await onMediaChanged?.();
      toast.success("Folder deleted.");
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not delete that folder right now."));
    } finally {
      setDeletingFolderPath(null);
    }
  };

  const handleDragEnter: React.DragEventHandler<HTMLDivElement> = (event) => {
    if (!media?.canManage || !Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = (event) => {
    if (!media?.canManage || !Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (event) => {
    if (!media?.canManage || !Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    if (!media?.canManage) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragActive(false);

    const files = Array.from(event.dataTransfer.files);
    void uploadFiles(files);
  };

  if (loading && !media) {
    if (!hasLoadedSnapshot) {
      return <ProjectMediaManagerSkeleton />;
    }
  }

  if (errorMessage && !media) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="text-sm text-destructive">{errorMessage}</p>
      </div>
    );
  }

  const canManage = media?.canManage ?? false;
  const folderMoveOptions = (media?.folderOptions ?? []).filter((folderPath) =>
    moveDialogFolderPath
      ? folderPath !== moveDialogFolderPath && !folderPath.startsWith(`${moveDialogFolderPath}/`)
      : true,
  );
  const canManageCurrentFolder = canManage && Boolean(media?.currentPath);

  return (
    <>
      <div
        className="relative flex h-full min-h-0"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <ProjectMediaManagerContent
          canManage={canManage}
          deferredSearch={deferredSearch}
          errorMessage={errorMessage}
          media={media}
          onDeleteFolderRequest={setDeleteFolderTargetPath}
          onDeleteImageRequest={setDeleteImageTarget}
          onMoveDialogFolderPathChange={handleOpenFolderMoveDialog}
          onMoveDialogImageChange={handleOpenImageMoveDialog}
          onMoveDestinationPathChange={setMoveDestinationPath}
          onMoveFolderDestinationPathChange={setMoveFolderDestinationPath}
          onPathChange={setCurrentPath}
          onSearchQueryChange={setSearchQuery}
          onUploadRequest={() => fileInputRef.current?.click()}
          searchQuery={searchQuery}
          uploading={uploading}
        />

        <ProjectMediaManagerSidebar
          canManage={canManage}
          canManageCurrentFolder={canManageCurrentFolder}
          creatingFolder={creatingFolder}
          currentPath={currentPath}
          deletingFolderPath={deletingFolderPath}
          media={media}
          movingFolderPath={movingFolderPath}
          newFolderName={newFolderName}
          onCreateFolder={() => void handleCreateFolder()}
          onDeleteCurrentFolder={() => {
            if (media?.currentPath) {
              setDeleteFolderTargetPath(media.currentPath);
            }
          }}
          onMoveCurrentFolder={() => {
            const folderPath = media?.currentPath ?? "";

            if (!folderPath) {
              return;
            }

            handleOpenFolderMoveDialog(folderPath);
            setMoveFolderDestinationPath(getParentFolderPath(folderPath) || ROOT_FOLDER_VALUE);
          }}
          onNewFolderNameChange={setNewFolderName}
          onUploadRequest={() => fileInputRef.current?.click()}
          uploading={uploading}
        />

        {isDragActive && canManage ? (
          <div className="pointer-events-none absolute inset-4 z-20 rounded-xl border border-dashed border-foreground/40 bg-background/90 backdrop-blur-sm">
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Upload className="h-8 w-8 text-foreground" />
              <div className="text-center">
                <p className="text-base font-medium text-foreground">Drop images to upload</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Files will be uploaded to {media?.currentPath || "Home"}.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />
      <ProjectMediaManagerDialogs
        deleteFolderTargetPath={deleteFolderTargetPath}
        deleteImageTarget={deleteImageTarget}
        deletingFolderPath={deletingFolderPath}
        deletingImagePath={deletingImagePath}
        folderMoveOptions={folderMoveOptions}
        folderOptions={media?.folderOptions ?? []}
        moveDestinationPath={moveDestinationPath}
        moveDialogFolderPath={moveDialogFolderPath}
        moveDialogImage={moveDialogImage}
        moveFolderDestinationPath={moveFolderDestinationPath}
        movingFolderPath={movingFolderPath}
        movingImageId={movingImageId}
        onConfirmDeleteFolder={() => void handleDeleteFolder()}
        onConfirmDeleteImage={() => void handleDeleteImage()}
        onConfirmMoveFolder={() => void handleMoveFolder()}
        onConfirmMoveImage={() => void handleMoveImage()}
        onMoveDestinationPathChange={setMoveDestinationPath}
        onMoveDialogFolderPathChange={handleOpenFolderMoveDialog}
        onMoveDialogImageChange={handleOpenImageMoveDialog}
        onMoveFolderDestinationPathChange={setMoveFolderDestinationPath}
        onRequestDeleteFolderChange={setDeleteFolderTargetPath}
        onRequestDeleteImageChange={setDeleteImageTarget}
      />
    </>
  );
}
