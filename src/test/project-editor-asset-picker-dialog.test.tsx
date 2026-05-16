import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorAssetPickerDialog } from "@/components/editor/project-editor/editor-asset-picker-dialog";
import type {
  ContentFileItem,
  ContentFilesLibrary,
  ContentMediaImage,
  ContentMediaLibrary,
} from "@/lib/content-runtime/shared";

const image: ContentMediaImage = {
  createdAt: "2026-04-30T10:00:00.000Z",
  fileName: "hero.png",
  folderPath: "",
  id: "image-1",
  objectPath: "hero.png",
  publicUrl: "https://assets.test/hero.png",
  sizeBytes: 2048,
  updatedAt: null,
};

const file: ContentFileItem = {
  createdAt: "2026-04-30T10:00:00.000Z",
  fileName: "brief.pdf",
  folderPath: "",
  id: "file-1",
  objectPath: "brief.pdf",
  publicUrl: "https://assets.test/brief.pdf",
  sizeBytes: 4096,
  updatedAt: null,
};

const createMediaLibrary = (): ContentMediaLibrary => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "media",
  canManage: true,
  currentPath: "",
  folderOptions: [],
  folders: [
    {
      imageCount: 2,
      name: "Heroes",
      path: "heroes",
      previewUrl: "https://assets.test/folder-preview.png",
    },
  ],
  images: [image],
  search: "",
  urlExpiresAt: "2026-04-30T11:00:00.000Z",
});

const createEmptyMediaLibrary = (search = "logo"): ContentMediaLibrary => ({
  ...createMediaLibrary(),
  folders: [],
  images: [],
  search,
});

const createFilesLibrary = (): ContentFilesLibrary => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "files",
  canManage: true,
  currentPath: "",
  fileCount: 1,
  files: [file],
  folderOptions: [],
  folders: [],
  search: "",
  urlExpiresAt: "2026-04-30T11:00:00.000Z",
});

const createEmptyFilesLibrary = (search = "policy"): ContentFilesLibrary => ({
  ...createFilesLibrary(),
  fileCount: 0,
  files: [],
  search,
});

describe("ProjectEditorAssetPickerDialog", () => {
  it("selects existing media first and inserts it only after Insert is pressed", async () => {
    const onSelectImage = vi.fn();

    render(
      <ProjectEditorAssetPickerDialog
        kind="media"
        library={createMediaLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectImage={onSelectImage}
        onUpload={vi.fn()}
        open
        uploading={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add image" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload images" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Insert image" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Select hero.png" }));

    expect(onSelectImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));

    expect(onSelectImage).toHaveBeenCalledWith(image);
  });

  it("lets editors open folders before choosing media", () => {
    const onPathChange = vi.fn();

    render(
      <ProjectEditorAssetPickerDialog
        kind="media"
        library={createMediaLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={onPathChange}
        onRefresh={vi.fn()}
        onSelectImage={vi.fn()}
        onUpload={vi.fn()}
        open
        uploading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Heroes" }));

    expect(onPathChange).toHaveBeenCalledWith("heroes");
  });

  it("keeps a selected media item visible and insertable when the current library page changes", () => {
    const onSelectImage = vi.fn();
    const { rerender } = render(
      <ProjectEditorAssetPickerDialog
        kind="media"
        library={createMediaLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectImage={onSelectImage}
        onUpload={vi.fn()}
        open
        uploading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select hero.png" }));

    rerender(
      <ProjectEditorAssetPickerDialog
        kind="media"
        library={createEmptyMediaLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectImage={onSelectImage}
        onUpload={vi.fn()}
        open
        uploading={false}
      />,
    );

    expect(screen.getByText("Selected image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select hero.png" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));

    expect(onSelectImage).toHaveBeenCalledWith(image);
  });

  it("selects existing files first and inserts only after Insert is pressed", () => {
    const onSelectFile = vi.fn();

    render(
      <ProjectEditorAssetPickerDialog
        kind="files"
        library={createFilesLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectFile={onSelectFile}
        onUpload={vi.fn()}
        open
        uploading={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload files" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Insert file" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Select brief.pdf" }));

    expect(onSelectFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Insert file" }));

    expect(onSelectFile).toHaveBeenCalledWith(file);
  });

  it("keeps a selected file visible and insertable when the current library page changes", () => {
    const onSelectFile = vi.fn();
    const { rerender } = render(
      <ProjectEditorAssetPickerDialog
        kind="files"
        library={createFilesLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectFile={onSelectFile}
        onUpload={vi.fn()}
        open
        uploading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select brief.pdf" }));

    rerender(
      <ProjectEditorAssetPickerDialog
        kind="files"
        library={createEmptyFilesLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectFile={onSelectFile}
        onUpload={vi.fn()}
        open
        uploading={false}
      />,
    );

    expect(screen.getByText("Selected file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select brief.pdf" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Insert file" }));

    expect(onSelectFile).toHaveBeenCalledWith(file);
  });

  it("uploads dropped files through the provided upload callback", async () => {
    const onUpload = vi.fn(async () => undefined);
    const droppedFile = new File(["image"], "fresh.png", { type: "image/png" });

    render(
      <ProjectEditorAssetPickerDialog
        kind="media"
        library={createMediaLibrary()}
        loading={false}
        onOpenChange={vi.fn()}
        onPathChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectImage={vi.fn()}
        onUpload={onUpload}
        open
        uploading={false}
      />,
    );

    fireEvent.drop(screen.getByRole("dialog"), {
      dataTransfer: {
        files: [droppedFile],
        types: ["Files"],
      },
    });

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith([droppedFile], "");
    });
  });
});
