"use client";

import {
  Folder,
  Image as ImageIcon,
  MoreHorizontal,
  Search,
  Upload,
} from "lucide-react";

import type { ContentMediaImage, ContentMediaLibrary } from "@/lib/content-runtime/shared";
import { formatBytes, formatDate, getParentFolderPath, ROOT_FOLDER_VALUE } from "@/components/editor/project-media-manager/support";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type ProjectMediaManagerContentProps = {
  canManage: boolean;
  deferredSearch: string;
  errorMessage: string | null;
  media: ContentMediaLibrary | null;
  onDeleteFolderRequest: (folderPath: string) => void;
  onDeleteImageRequest: (image: ContentMediaImage) => void;
  onMoveDialogFolderPathChange: (folderPath: string | null) => void;
  onMoveDialogImageChange: (image: ContentMediaImage | null) => void;
  onMoveDestinationPathChange: (path: string) => void;
  onMoveFolderDestinationPathChange: (path: string) => void;
  onPathChange: (path: string) => void;
  onSearchQueryChange: (value: string) => void;
  onUploadRequest: () => void;
  searchQuery: string;
  uploading: boolean;
};

export function ProjectMediaManagerContent({
  canManage,
  deferredSearch,
  errorMessage,
  media,
  onDeleteFolderRequest,
  onDeleteImageRequest,
  onMoveDialogFolderPathChange,
  onMoveDialogImageChange,
  onMoveDestinationPathChange,
  onMoveFolderDestinationPathChange,
  onPathChange,
  onSearchQueryChange,
  onUploadRequest,
  searchQuery,
  uploading,
}: ProjectMediaManagerContentProps) {
  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Media</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Browse your image library with folders, search, and drag-and-drop uploads.
            </p>
          </div>

          <div className="flex w-full max-w-md items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={media?.currentPath ? "Search this folder" : "Search images"}
                className="h-10 border-border pl-10"
              />
            </div>
            {canManage ? (
              <Button type="button" variant="outline" size="sm" className="h-10 gap-2" onClick={onUploadRequest} disabled={uploading}>
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              {media?.breadcrumbs.map((breadcrumb, index) => {
                const isLast = index === (media?.breadcrumbs.length ?? 1) - 1;

                return (
                  <div key={breadcrumb.path || "__home__"} className="contents">
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            onPathChange(breadcrumb.path);
                          }}
                        >
                          {breadcrumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast ? <BreadcrumbSeparator /> : null}
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>

          <Badge variant="outline" className="border-border text-xs text-muted-foreground">
            {media?.bucketName}
          </Badge>
          {deferredSearch.trim() ? (
            <Badge variant="outline" className="border-border text-xs text-muted-foreground">
              Search: {deferredSearch.trim()}
            </Badge>
          ) : null}
        </div>

        {errorMessage ? <p className="mb-6 text-sm text-destructive">{errorMessage}</p> : null}

        {!deferredSearch.trim() && media?.folders.length ? (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Folders</h3>
              <span className="text-xs text-muted-foreground">{media.folders.length} items</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {media.folders.map((folder) => (
                <Card
                  key={folder.path}
                  className="group relative cursor-pointer border-border bg-card transition-colors hover:border-muted-foreground/30"
                  onClick={() => onPathChange(folder.path)}
                >
                  {canManage ? (
                    <div className="absolute right-3 top-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 bg-background/85 backdrop-blur"
                            aria-label="Folder options"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Folder actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              onPathChange(folder.path);
                            }}
                          >
                            Open folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              onMoveDialogFolderPathChange(folder.path);
                              onMoveFolderDestinationPathChange(getParentFolderPath(folder.path) || ROOT_FOLDER_VALUE);
                            }}
                          >
                            Move folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={(event) => {
                              event.preventDefault();
                              onDeleteFolderRequest(folder.path);
                            }}
                          >
                            Delete folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}

                  <CardContent className="p-0">
                    <div className="grid min-h-[128px] grid-cols-[120px_minmax(0,1fr)]">
                      <div className="border-r border-border bg-secondary/70 p-3">
                        {folder.previewUrl ? (
                          <AspectRatio ratio={1}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={folder.previewUrl}
                              alt={folder.name}
                              className="h-full w-full rounded-md object-cover"
                            />
                          </AspectRatio>
                        ) : (
                          <div className="flex h-full min-h-[94px] items-center justify-center rounded-md border border-dashed border-border bg-background/40">
                            <Folder className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-col justify-between p-4">
                        <div>
                          <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {folder.imageCount} {folder.imageCount === 1 ? "image" : "images"}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                          <Folder className="h-3.5 w-3.5" />
                          Open folder
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {deferredSearch.trim() ? "Search Results" : "Images"}
            </h3>
            <span className="text-xs text-muted-foreground">{media?.images.length ?? 0} items</span>
          </div>

          {media?.images.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {media.images.map((image) => (
                <Card key={image.id} className="overflow-hidden border-border bg-card">
                  <CardContent className="p-0">
                    <div className="relative">
                      <AspectRatio ratio={4 / 3}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.publicUrl}
                          alt={image.fileName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </AspectRatio>

                      <div className="absolute right-3 top-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="secondary" size="icon" className="h-8 w-8 bg-background/85 backdrop-blur" aria-label="Image options">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Image actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onSelect={(event) => {
                                event.preventDefault();
                                window.open(image.publicUrl, "_blank", "noopener,noreferrer");
                              }}
                            >
                              Open image
                            </DropdownMenuItem>
                            {canManage ? (
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  onMoveDialogImageChange(image);
                                  onMoveDestinationPathChange(image.folderPath ? image.folderPath : ROOT_FOLDER_VALUE);
                                }}
                              >
                                Move image
                              </DropdownMenuItem>
                            ) : null}
                            {canManage ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(event) => {
                                  event.preventDefault();
                                  onDeleteImageRequest(image);
                                }}
                              >
                                Delete image
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{image.fileName}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{image.folderPath || "Home"}</p>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{formatBytes(image.sizeBytes)}</span>
                        <span>{formatDate(image.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {deferredSearch.trim() ? "No images match this search" : "No images here yet"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {deferredSearch.trim()
                  ? "Try a different search term or clear the search to browse the current folder."
                  : canManage
                    ? "Drop images anywhere on this page or use the upload button to add files."
                    : "This folder does not contain any images yet."}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
