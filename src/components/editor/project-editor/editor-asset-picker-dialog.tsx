"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FileText,
  Folder,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Upload,
  type LucideIcon,
} from "lucide-react";

import type {
  ContentFileItem,
  ContentFilesLibrary,
  ContentMediaImage,
  ContentMediaLibrary,
} from "@/lib/content-runtime/shared";
import { formatBytes as formatMediaBytes } from "@/components/editor/project-media-manager/support";
import { formatBytes as formatFileBytes } from "@/components/editor/project-files-manager/support";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ProjectEditorAssetPickerDialogProps =
  | {
      kind: "media";
      library: ContentMediaLibrary | null;
      loading: boolean;
      onOpenChange: (open: boolean) => void;
      onPathChange: (path: string) => void;
      onRefresh: (search?: string) => void;
      onSelectImage: (image: ContentMediaImage) => void;
      onUpload: (files: File[], path: string) => Promise<void> | void;
      open: boolean;
      uploading: boolean;
    }
  | {
      kind: "files";
      library: ContentFilesLibrary | null;
      loading: boolean;
      onOpenChange: (open: boolean) => void;
      onPathChange: (path: string) => void;
      onRefresh: (search?: string) => void;
      onSelectFile: (file: ContentFileItem) => void;
      onUpload: (files: File[], path: string) => Promise<void> | void;
      open: boolean;
      uploading: boolean;
    };

const isFileDrop = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

export function ProjectEditorAssetPickerDialog(props: ProjectEditorAssetPickerDialogProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [selectedImage, setSelectedImage] = useState<ContentMediaImage | null>(null);
  const [selectedFile, setSelectedFile] = useState<ContentFileItem | null>(null);
  const isMedia = props.kind === "media";
  const title = isMedia ? "Add image" : "Add file";
  const uploadLabel = isMedia ? "Upload images" : "Upload files";
  const insertLabel = isMedia ? "Insert image" : "Insert file";
  const accepts = isMedia ? "image/*" : undefined;
  const currentPath = props.library?.currentPath ?? "";
  const folders = props.library?.folders ?? [];
  const folderCountLabel = folders.length === 1 ? "1 folder" : `${folders.length} folders`;
  const hasSelectedAsset = isMedia ? Boolean(selectedImage) : Boolean(selectedFile);

  useEffect(() => {
    setSelectedImage(null);
    setSelectedFile(null);
  }, [props.kind]);

  const uploadFiles = (files: File[]) => {
    if (!files.length || props.uploading) {
      return;
    }

    void props.onUpload(files, currentPath);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onRefresh(searchQuery);
  };

  const insertSelectedAsset = () => {
    if (props.kind === "media") {
      if (selectedImage) {
        props.onSelectImage(selectedImage);
      }
      return;
    }

    if (selectedFile) {
      props.onSelectFile(selectedFile);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className={[
          "max-h-[92vh] max-w-6xl overflow-hidden p-0",
          isDragActive ? "ring-2 ring-inset ring-primary/50" : "",
        ].join(" ")}
        onDragEnter={(event) => {
          if (!isFileDrop(event)) {
            return;
          }

          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          if (!isFileDrop(event)) {
            return;
          }

          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

          if (dragDepthRef.current === 0) {
            setIsDragActive(false);
          }
        }}
        onDragOver={(event) => {
          if (!isFileDrop(event)) {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (!isFileDrop(event)) {
            return;
          }

          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDragActive(false);
          uploadFiles(Array.from(event.dataTransfer.files ?? []));
        }}
      >
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex flex-col gap-4 pr-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {currentPath ? currentPath : "Home"} · {folderCountLabel}
              </DialogDescription>
            </div>

            <form className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-xl" onSubmit={handleSearchSubmit}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={isMedia ? "Search images" : "Search files"}
                  className="h-9 pl-9"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" disabled={props.loading}>
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh library"
                disabled={props.loading}
                onClick={() => props.onRefresh(searchQuery)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={uploadLabel}
                onClick={() => fileInputRef.current?.click()}
                disabled={props.uploading}
              >
                <Upload className="h-4 w-4" />
                {props.uploading ? "Uploading..." : "Upload"}
              </Button>
              <Button
                type="button"
                variant="hero"
                size="sm"
                disabled={!hasSelectedAsset}
                onClick={insertSelectedAsset}
              >
                {insertLabel}
              </Button>
            </form>
          </div>
        </DialogHeader>

        <div className="relative grid max-h-[calc(92vh-80px)] min-h-[620px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <input
            ref={fileInputRef}
            type="file"
            accept={accepts}
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              uploadFiles(files);
            }}
          />

          <div className="border-b border-border px-6 py-3">
            <FolderBreadcrumbs
              breadcrumbs={props.library?.breadcrumbs ?? [{ label: "Home", path: "" }]}
              onPathChange={props.onPathChange}
            />
          </div>

          <div className="overflow-y-auto px-6 py-5">
            {props.loading && !props.library ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                Loading library...
              </div>
            ) : isMedia ? (
              <MediaAssetGrid
                folders={props.library?.folders ?? []}
                images={props.library?.images ?? []}
                onFolderOpen={props.onPathChange}
                onSelect={setSelectedImage}
                selectedImage={selectedImage}
                selectedImageId={selectedImage?.id ?? null}
              />
            ) : (
              <FileAssetList
                files={props.library?.files ?? []}
                folders={props.library?.folders ?? []}
                onFolderOpen={props.onPathChange}
                onSelect={setSelectedFile}
                selectedFile={selectedFile}
                selectedFileId={selectedFile?.id ?? null}
              />
            )}
          </div>

          {isDragActive ? (
            <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-xl border border-dashed border-foreground/40 bg-background/90 text-center backdrop-blur-sm">
              <div>
                <Upload className="mx-auto h-8 w-8 text-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Drop to upload into {currentPath || "Home"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FolderBreadcrumbs = ({
  breadcrumbs,
  onPathChange,
}: {
  breadcrumbs: Array<{ label: string; path: string }>;
  onPathChange: (path: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 text-sm">
    {breadcrumbs.map((breadcrumb, index) => {
      const isLast = index === breadcrumbs.length - 1;

      return (
        <React.Fragment key={breadcrumb.path || "__home__"}>
          {isLast ? (
            <span className="font-medium text-foreground">{breadcrumb.label}</span>
          ) : (
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onPathChange(breadcrumb.path)}
            >
              {breadcrumb.label}
            </button>
          )}
          {!isLast ? <span className="text-muted-foreground">/</span> : null}
        </React.Fragment>
      );
    })}
  </div>
);

const FolderGrid = ({
  folders,
  onFolderOpen,
}: {
  folders: Array<{ imageCount: number; name: string; path: string; previewUrl: string | null }>;
  onFolderOpen: (path: string) => void;
}) => {
  if (!folders.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Folders</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {folders.map((folder) => (
          <button
            key={folder.path}
            type="button"
            aria-label={`Open ${folder.name}`}
            className="grid min-h-[84px] grid-cols-[64px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => onFolderOpen(folder.path)}
          >
            <span className="flex items-center justify-center border-r border-border bg-secondary">
              {folder.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={folder.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Folder className="h-5 w-5 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 p-3">
              <span className="block truncate text-sm font-medium text-foreground">{folder.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {folder.imageCount} {folder.imageCount === 1 ? "item" : "items"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

const MediaAssetGrid = ({
  folders,
  images,
  onFolderOpen,
  onSelect,
  selectedImage,
  selectedImageId,
}: {
  folders: ContentMediaLibrary["folders"];
  images: ContentMediaImage[];
  onFolderOpen: (path: string) => void;
  onSelect: (image: ContentMediaImage) => void;
  selectedImage: ContentMediaImage | null;
  selectedImageId: string | null;
}) => {
  const selectedImageIsVisible =
    Boolean(selectedImage) && images.some((image) => image.id === selectedImage?.id);
  const selectedImages =
    selectedImage && !selectedImageIsVisible ? [selectedImage] : [];

  if (!folders.length && !images.length && !selectedImages.length) {
    return (
      <EmptyAssetState
        icon={ImageIcon}
        title="No images found"
        description="Upload a new image or try a different search."
      />
    );
  }

  return (
    <div className="space-y-7">
      {selectedImages.length ? (
        <MediaImageGridSection
          images={selectedImages}
          onSelect={onSelect}
          selectedImageId={selectedImageId}
          title="Selected image"
        />
      ) : null}
      <FolderGrid folders={folders} onFolderOpen={onFolderOpen} />
      {images.length ? (
        <MediaImageGridSection
          images={images}
          onSelect={onSelect}
          selectedImageId={selectedImageId}
          title="Images"
        />
      ) : null}
    </div>
  );
};

const MediaImageGridSection = ({
  images,
  onSelect,
  selectedImageId,
  title,
}: {
  images: ContentMediaImage[];
  onSelect: (image: ContentMediaImage) => void;
  selectedImageId: string | null;
  title: string;
}) => (
  <section className="space-y-3">
    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {images.map((image) => (
        <button
          key={image.id}
          type="button"
          className={[
            "group overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring",
            selectedImageId === image.id ? "border-primary ring-1 ring-primary/50" : "border-border",
          ].join(" ")}
          aria-label={`Select ${image.fileName}`}
          onClick={() => onSelect(image)}
        >
          <AspectRatio ratio={4 / 3}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.publicUrl} alt={image.fileName} className="h-full w-full object-cover" />
          </AspectRatio>
          <div className="space-y-2 p-3">
            <p className="truncate text-sm font-medium text-foreground">{image.fileName}</p>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{image.folderPath || "Home"}</span>
              <span>{formatMediaBytes(image.sizeBytes)}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  </section>
);

const FileAssetList = ({
  files,
  folders,
  onFolderOpen,
  onSelect,
  selectedFile,
  selectedFileId,
}: {
  files: ContentFileItem[];
  folders: ContentFilesLibrary["folders"];
  onFolderOpen: (path: string) => void;
  onSelect: (file: ContentFileItem) => void;
  selectedFile: ContentFileItem | null;
  selectedFileId: string | null;
}) => {
  const selectedFileIsVisible =
    Boolean(selectedFile) && files.some((file) => file.id === selectedFile?.id);
  const selectedFiles =
    selectedFile && !selectedFileIsVisible ? [selectedFile] : [];

  if (!folders.length && !files.length && !selectedFiles.length) {
    return (
      <EmptyAssetState
        icon={FileText}
        title="No files found"
        description="Upload a new file or try a different search."
      />
    );
  }

  return (
    <div className="space-y-7">
      <FolderGrid folders={folders} onFolderOpen={onFolderOpen} />
      {selectedFiles.length ? (
        <FileAssetListSection
          files={selectedFiles}
          onSelect={onSelect}
          selectedFileId={selectedFileId}
          title="Selected file"
        />
      ) : null}
      {files.length ? (
        <FileAssetListSection
          files={files}
          onSelect={onSelect}
          selectedFileId={selectedFileId}
          title="Files"
        />
      ) : null}
    </div>
  );
};

const FileAssetListSection = ({
  files,
  onSelect,
  selectedFileId,
  title,
}: {
  files: ContentFileItem[];
  onSelect: (file: ContentFileItem) => void;
  selectedFileId: string | null;
  title: string;
}) => (
  <section className="space-y-3">
    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
    <div className="space-y-3">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          className={[
            "flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring",
            selectedFileId === file.id ? "border-primary ring-1 ring-primary/50" : "border-border",
          ].join(" ")}
          aria-label={`Select ${file.fileName}`}
          onClick={() => onSelect(file)}
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
            <FileText className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{file.fileName}</span>
            <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Folder className="h-3.5 w-3.5 flex-shrink-0" />
              {file.folderPath || "Home"}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">{formatFileBytes(file.sizeBytes)}</span>
        </button>
      ))}
    </div>
  </section>
);

const EmptyAssetState = ({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
    <Icon className="h-8 w-8 text-muted-foreground" />
    <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </div>
);
