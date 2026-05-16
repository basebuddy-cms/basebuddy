"use client";

import { FilePlus2, FileText, FolderPlus, MoveRight, Trash2, Upload } from "lucide-react";

import type { ContentFilesLibrary } from "@/lib/content-runtime/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type ProjectFilesManagerSidebarProps = {
  canManage: boolean;
  canManageCurrentFolder: boolean;
  creatingFolder: boolean;
  currentPath: string;
  deletingFolderPath: string | null;
  files: ContentFilesLibrary | null;
  movingFolderPath: string | null;
  newFolderName: string;
  onCreateFolder: () => void;
  onDeleteCurrentFolder: () => void;
  onMoveCurrentFolder: () => void;
  onNewFolderNameChange: (value: string) => void;
  onUploadRequest: () => void;
  uploading: boolean;
};

export function ProjectFilesManagerSidebar({
  canManage,
  canManageCurrentFolder,
  creatingFolder,
  currentPath,
  deletingFolderPath,
  files,
  movingFolderPath,
  newFolderName,
  onCreateFolder,
  onDeleteCurrentFolder,
  onMoveCurrentFolder,
  onNewFolderNameChange,
  onUploadRequest,
  uploading,
}: ProjectFilesManagerSidebarProps) {
  return (
    <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-border bg-card">
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            <FileText className="h-3.5 w-3.5" />
            Files
          </div>

          {canManage ? (
            <div className="space-y-5">
              {canManageCurrentFolder ? (
                <div className="space-y-3">
                  <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={onMoveCurrentFolder} disabled={Boolean(movingFolderPath)}>
                    <MoveRight className="h-3.5 w-3.5" />
                    {movingFolderPath === files?.currentPath ? "Moving..." : "Move Folder"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDeleteCurrentFolder}
                    disabled={Boolean(deletingFolderPath)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingFolderPath === files?.currentPath ? "Deleting..." : "Delete Folder"}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Upload Files</p>
                <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={onUploadRequest} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Uploading..." : "Choose Files"}
                </Button>
                <p className="text-xs leading-6 text-muted-foreground">
                  Drop documents, PDFs, CSVs, and other non-image files anywhere on the page to upload them into {currentPath || "Home"}.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Create Folder</p>
                <div>
                  <Label
                    htmlFor="files-folder-name"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Folder Name
                  </Label>
                  <Input
                    id="files-folder-name"
                    value={newFolderName}
                    onChange={(event) => onNewFolderNameChange(event.target.value)}
                    placeholder="Client documents"
                    className="h-8 border-border text-xs"
                    disabled={creatingFolder}
                  />
                </div>
                <Button
                  type="button"
                  variant="hero"
                  size="sm"
                  className="w-full gap-2"
                  disabled={!newFolderName.trim() || creatingFolder}
                  onClick={onCreateFolder}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  {creatingFolder ? "Creating..." : "Create Folder"}
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Notes
                </div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  Image files are managed from Media. Files uploaded here stay in file storage but are filtered out of the image library.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <p className="text-sm text-foreground">Read-only access</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                You can browse the project files library, but this account cannot upload, move, or delete files.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
