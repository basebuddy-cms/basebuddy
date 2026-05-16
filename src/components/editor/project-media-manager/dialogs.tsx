"use client";

import type { ContentMediaImage } from "@/lib/content-runtime/shared";

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

import { getFolderName, ROOT_FOLDER_VALUE } from "@/components/editor/project-media-manager/support";

type ProjectMediaManagerDialogsProps = {
  deleteFolderTargetPath: string | null;
  deleteImageTarget: ContentMediaImage | null;
  deletingFolderPath: string | null;
  deletingImagePath: string | null;
  folderMoveOptions: string[];
  folderOptions: string[];
  moveDestinationPath: string;
  moveDialogFolderPath: string | null;
  moveDialogImage: ContentMediaImage | null;
  moveFolderDestinationPath: string;
  movingFolderPath: string | null;
  movingImageId: string | null;
  onConfirmDeleteFolder: () => void;
  onConfirmDeleteImage: () => void;
  onConfirmMoveFolder: () => void;
  onConfirmMoveImage: () => void;
  onMoveDestinationPathChange: (value: string) => void;
  onMoveDialogFolderPathChange: (value: string | null) => void;
  onMoveDialogImageChange: (value: ContentMediaImage | null) => void;
  onMoveFolderDestinationPathChange: (value: string) => void;
  onRequestDeleteFolderChange: (value: string | null) => void;
  onRequestDeleteImageChange: (value: ContentMediaImage | null) => void;
};

export function ProjectMediaManagerDialogs({
  deleteFolderTargetPath,
  deleteImageTarget,
  deletingFolderPath,
  deletingImagePath,
  folderMoveOptions,
  folderOptions,
  moveDestinationPath,
  moveDialogFolderPath,
  moveDialogImage,
  moveFolderDestinationPath,
  movingFolderPath,
  movingImageId,
  onConfirmDeleteFolder,
  onConfirmDeleteImage,
  onConfirmMoveFolder,
  onConfirmMoveImage,
  onMoveDestinationPathChange,
  onMoveDialogFolderPathChange,
  onMoveDialogImageChange,
  onMoveFolderDestinationPathChange,
  onRequestDeleteFolderChange,
  onRequestDeleteImageChange,
}: ProjectMediaManagerDialogsProps) {
  return (
    <>
      <Dialog
        open={Boolean(moveDialogImage)}
        onOpenChange={(open) => {
          if (!open && !movingImageId) {
            onMoveDialogImageChange(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move image</DialogTitle>
            <DialogDescription>
              Choose a destination folder for {moveDialogImage?.fileName ?? "this image"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="media-move-folder">Destination</Label>
            <Select value={moveDestinationPath} onValueChange={onMoveDestinationPathChange}>
              <SelectTrigger id="media-move-folder">
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
              onClick={() => onMoveDialogImageChange(null)}
              disabled={Boolean(movingImageId)}
            >
              Cancel
            </Button>
            <Button type="button" variant="hero" onClick={onConfirmMoveImage} disabled={Boolean(movingImageId)}>
              <MoveRight className="h-4 w-4" />
              {movingImageId ? "Moving..." : "Move image"}
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
            <Label htmlFor="media-move-folder-destination">Destination</Label>
            <Select value={moveFolderDestinationPath} onValueChange={onMoveFolderDestinationPathChange}>
              <SelectTrigger id="media-move-folder-destination">
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
        open={Boolean(deleteImageTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingImagePath) {
            onRequestDeleteImageChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteImageTarget
                ? `${deleteImageTarget.fileName} will be deleted from the media library.`
                : "This image will be deleted from the media library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingImagePath)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirmDeleteImage();
              }}
              disabled={Boolean(deletingImagePath)}
            >
              {deletingImagePath ? "Deleting..." : "Delete image"}
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
                ? `${getFolderName(deleteFolderTargetPath)} and everything inside it will be deleted from the media library.`
                : "This folder and everything inside it will be deleted from the media library."}
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
