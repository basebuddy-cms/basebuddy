"use client";

import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Folder,
  MoreHorizontal,
  Search,
  Upload,
} from "lucide-react";

import type { ContentFileItem, ContentFilesLibrary } from "@/lib/content-runtime/shared";
import {
  formatBytes,
  formatDate,
  getParentFolderPath,
  ROOT_FOLDER_VALUE,
} from "@/components/editor/project-files-manager/support";

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

type ProjectFilesManagerContentProps = {
  canManage: boolean;
  deferredSearch: string;
  errorMessage: string | null;
  filesLibrary: ContentFilesLibrary | null;
  onDeleteFileRequest: (file: ContentFileItem) => void;
  onDeleteFolderRequest: (folderPath: string) => void;
  onMoveDialogFileChange: (file: ContentFileItem | null) => void;
  onMoveDialogFolderPathChange: (folderPath: string | null) => void;
  onMoveDestinationPathChange: (path: string) => void;
  onMoveFolderDestinationPathChange: (path: string) => void;
  onPathChange: (path: string) => void;
  onSearchQueryChange: (value: string) => void;
  onUploadRequest: () => void;
  searchQuery: string;
  uploading: boolean;
};

export function ProjectFilesManagerContent({
  canManage,
  deferredSearch,
  errorMessage,
  filesLibrary,
  onDeleteFileRequest,
  onDeleteFolderRequest,
  onMoveDialogFileChange,
  onMoveDialogFolderPathChange,
  onMoveDestinationPathChange,
  onMoveFolderDestinationPathChange,
  onPathChange,
  onSearchQueryChange,
  onUploadRequest,
  searchQuery,
  uploading,
}: ProjectFilesManagerContentProps) {
  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Files</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Browse your file library with folders, search, and drag-and-drop uploads for non-image assets.
            </p>
          </div>

          <div className="flex w-full max-w-md items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={filesLibrary?.currentPath ? "Search this folder" : "Search files"}
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
              {filesLibrary?.breadcrumbs.map((breadcrumb, index) => {
                const isLast = index === (filesLibrary?.breadcrumbs.length ?? 1) - 1;

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
            {filesLibrary?.bucketName}
          </Badge>
          {deferredSearch.trim() ? (
            <Badge variant="outline" className="border-border text-xs text-muted-foreground">
              Search: {deferredSearch.trim()}
            </Badge>
          ) : null}
        </div>

        {errorMessage ? <p className="mb-6 text-sm text-destructive">{errorMessage}</p> : null}

        {!deferredSearch.trim() && filesLibrary?.folders.length ? (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Folders</h3>
              <span className="text-xs text-muted-foreground">{filesLibrary.folders.length} items</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filesLibrary.folders.map((folder) => (
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

                  <CardContent className="grid min-h-[112px] grid-cols-[72px_minmax(0,1fr)] p-0">
                    <div className="flex items-center justify-center border-r border-border bg-secondary/70 p-3">
                      <Folder className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-2 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {folder.imageCount} {folder.imageCount === 1 ? "file" : "files"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {folder.path}
                      </p>
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
              {deferredSearch.trim() ? "Search Results" : "Files"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {filesLibrary?.fileCount ?? 0} {(filesLibrary?.fileCount ?? 0) === 1 ? "item" : "items"}
            </span>
          </div>

          {!filesLibrary?.files.length ? (
            <Card className="border-dashed border-border">
              <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/70" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {deferredSearch.trim() ? "No matching files" : "No files here yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {deferredSearch.trim()
                      ? "Try a different search term."
                      : "Upload files or create a folder to organize this library."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filesLibrary.files.map((file) => (
                <Card key={file.id} className="border-border bg-card">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{file.fileName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {file.folderPath || "Home"}
                      </p>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:text-right">
                      <span>{formatBytes(file.sizeBytes)}</span>
                      <span>{formatDate(file.updatedAt ?? file.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild type="button" variant="outline" size="sm" className="gap-2">
                        <Link href={file.publicUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Link>
                      </Button>
                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="secondary" size="icon" className="h-8 w-8" aria-label="File options">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">File actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={file.publicUrl} target="_blank" rel="noreferrer">
                                Open file
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(event) => {
                                event.preventDefault();
                                onMoveDialogFileChange(file);
                                onMoveDestinationPathChange(file.folderPath || ROOT_FOLDER_VALUE);
                              }}
                            >
                              Move file
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(event) => {
                                event.preventDefault();
                                onDeleteFileRequest(file);
                              }}
                            >
                              Delete file
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
