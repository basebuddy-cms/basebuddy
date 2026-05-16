"use client";

import type { ContentFileItem } from "@/lib/content-runtime/shared";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoveRight } from "lucide-react";

import { getFolderName, ROOT_FOLDER_VALUE } from "@/components/editor/project-files-manager/support";

type ProjectFilesManagerDialogsProps = {
  deleteFileTarget: ContentFileItem | null;
  deleteFolderTargetPath: string | null;
  deletingFilePath: string | null;
  deletingFolderPath: string | null;
  folderMoveOptions: string[];
  folderOptions: string[];
  moveDestinationPath: string;
  moveDialogFile: ContentFileItem | null;
  moveDialogFolderPath: string | null;
  moveFolderDestinationPath: string;
  movingFilePath: string | null;
  movingFolderPath: string | null;
  onConfirmDeleteFile: () => void;
  onConfirmDeleteFolder: () => void;
  onConfirmMoveFile: () => void;
  onConfirmMoveFolder: () => void;
  onMoveDestinationPathChange: (value: string) => void;
  onMoveDialogFileChange: (value: ContentFileItem | null) => void;
  onMoveDialogFolderPathChange: (value: string | null) => void;
  onMoveFolderDestinationPathChange: (value: string) => void;
  onRequestDeleteFileChange: (value: ContentFileItem | null) => void;
  onRequestDeleteFolderChange: (value: string | null) => void;
};

export function ProjectFilesManagerDialogs({
  deleteFileTarget,
  deleteFolderTargetPath,
  deletingFilePath,
  deletingFolderPath,
  folderMoveOptions,
  folderOptions,
  moveDestinationPath,
  moveDialogFile,
  moveDialogFolderPath,
  moveFolderDestinationPath,
  movingFilePath,
  movingFolderPath,
  onConfirmDeleteFile,
  onConfirmDeleteFolder,
  onConfirmMoveFile,
  onConfirmMoveFolder,
  onMoveDestinationPathChange,
  onMoveDialogFileChange,
  onMoveDialogFolderPathChange,
  onMoveFolderDestinationPathChange,
  onRequestDeleteFileChange,
  onRequestDeleteFolderChange,
}: ProjectFilesManagerDialogsProps) {
  return (
    <>
      <Dialog
        open={Boolean(moveDialogFile)}
        onOpenChange={(open) => {
          if (!open && !movingFilePath) {
            onMoveDialogFileChange(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>
              Choose a destination folder for {moveDialogFile?.fileName ?? "this file"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="files-move-folder">Destination</Label>
            <Select value={moveDestinationPath} onValueChange={onMoveDestinationPathChange}>
              <SelectTrigger id="files-move-folder">
                <SelectValue placeholder="Choose a folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_FOLDER_VALUE}>Home</SelectItem>
                {folderOptions.map((folderPath) => (
                  <SelectItem key={folderPath} value={folderPath}>
                    {folderPath}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onMoveDialogFileChange(null)}
              disabled={Boolean(movingFilePath)}
            >
              Cancel
            </Button>
            <Button type="button" variant="hero" onClick={onConfirmMoveFile} disabled={Boolean(movingFilePath)}>
              <MoveRight className="h-4 w-4" />
              {movingFilePath ? "Moving..." : "Move file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moveDialogFolderPath)}
        onOpenChange={(open) => {
          if (!open && !movingFolderPath) {
            onMoveDialogFolderPathChange(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move folder</DialogTitle>
            <DialogDescription>
              Choose a destination folder for {moveDialogFolderPath ? getFolderName(moveDialogFolderPath) : "this folder"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="files-move-folder-destination">Destination</Label>
            <Select value={moveFolderDestinationPath} onValueChange={onMoveFolderDestinationPathChange}>
              <SelectTrigger id="files-move-folder-destination">
                <SelectValue placeholder="Choose a folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_FOLDER_VALUE}>Home</SelectItem>
                {folderMoveOptions.map((folderPath) => (
                  <SelectItem key={folderPath} value={folderPath}>
                    {folderPath}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onMoveDialogFolderPathChange(null)}
              disabled={Boolean(movingFolderPath)}
            >
              Cancel
            </Button>
            <Button type="button" variant="hero" onClick={onConfirmMoveFolder} disabled={Boolean(movingFolderPath)}>
              <MoveRight className="h-4 w-4" />
              {movingFolderPath ? "Moving..." : "Move folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteFileTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingFilePath) {
            onRequestDeleteFileChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFileTarget
                ? `${deleteFileTarget.fileName} will be deleted from the file library.`
                : "This file will be deleted from the file library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingFilePath)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirmDeleteFile();
              }}
              disabled={Boolean(deletingFilePath)}
            >
              {deletingFilePath ? "Deleting..." : "Delete file"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteFolderTargetPath)}
        onOpenChange={(open) => {
          if (!open && !deletingFolderPath) {
            onRequestDeleteFolderChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFolderTargetPath
                ? `${getFolderName(deleteFolderTargetPath)} and everything inside it will be deleted from the file library.`
                : "This folder and everything inside it will be deleted from the file library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingFolderPath)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirmDeleteFolder();
              }}
              disabled={Boolean(deletingFolderPath)}
            >
              {deletingFolderPath ? "Deleting..." : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
