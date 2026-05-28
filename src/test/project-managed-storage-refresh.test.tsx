import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  completeContentRuntimeDirectUploads,
  prepareContentRuntimeDirectUploads,
  toastError,
  toastSuccess,
  uploadPreparedContentRuntimeFile,
  validateFileUpload,
  validateImageUploadFile,
} = vi.hoisted(() => ({
  completeContentRuntimeDirectUploads: vi.fn(),
  prepareContentRuntimeDirectUploads: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  uploadPreparedContentRuntimeFile: vi.fn(),
  validateFileUpload: vi.fn(),
  validateImageUploadFile: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("@/lib/content-runtime/client-upload-api", () => ({
  completeContentRuntimeDirectUploads,
  prepareContentRuntimeDirectUploads,
}));

vi.mock("@/lib/content-runtime/client-direct-upload", () => ({
  uploadPreparedContentRuntimeFile,
}));

vi.mock("@/lib/security/upload-validation", () => ({
  MAX_FILE_UPLOAD_BYTES: 25 * 1024 * 1024,
  MAX_MEDIA_UPLOAD_BYTES: 10 * 1024 * 1024,
  validateFileUpload,
  validateImageUploadFile,
}));

vi.mock("@/components/editor/project-media-manager/content", () => ({
  ProjectMediaManagerContent: () => null,
}));

vi.mock("@/components/editor/project-media-manager/dialogs", () => ({
  ProjectMediaManagerDialogs: () => null,
}));

vi.mock("@/components/editor/project-media-manager/sidebar", () => ({
  ProjectMediaManagerSidebar: () => null,
}));

vi.mock("@/components/editor/project-media-manager/skeleton", () => ({
  ProjectMediaManagerSkeleton: () => null,
}));

vi.mock("@/components/editor/project-files-manager/content", () => ({
  ProjectFilesManagerContent: () => null,
}));

vi.mock("@/components/editor/project-files-manager/dialogs", () => ({
  ProjectFilesManagerDialogs: ({
    deleteFolderTargetPath,
    moveDialogFolderPath,
    onConfirmDeleteFolder,
    onConfirmMoveFolder,
  }: {
    deleteFolderTargetPath: string | null;
    moveDialogFolderPath: string | null;
    onConfirmDeleteFolder: () => void;
    onConfirmMoveFolder: () => void;
  }) => (
    <>
      {moveDialogFolderPath ? (
        <button type="button" onClick={onConfirmMoveFolder}>
          confirm-move-folder
        </button>
      ) : null}
      {deleteFolderTargetPath ? (
        <button type="button" onClick={onConfirmDeleteFolder}>
          confirm-delete-folder
        </button>
      ) : null}
    </>
  ),
}));

vi.mock("@/components/editor/project-files-manager/sidebar", () => ({
  ProjectFilesManagerSidebar: ({
    onDeleteCurrentFolder,
    onMoveCurrentFolder,
  }: {
    onDeleteCurrentFolder: () => void;
    onMoveCurrentFolder: () => void;
  }) => (
    <>
      <button type="button" onClick={onMoveCurrentFolder}>
        move-current-folder
      </button>
      <button type="button" onClick={onDeleteCurrentFolder}>
        delete-current-folder
      </button>
    </>
  ),
}));

vi.mock("@/components/editor/project-files-manager/skeleton", () => ({
  ProjectFilesManagerSkeleton: () => null,
}));

import { ProjectFilesManager } from "@/components/editor/project-files-manager";
import { ProjectMediaManager } from "@/components/editor/project-media-manager";
import type {
  ContentFilesLibrary,
  ContentMediaLibrary,
  ContentPreparedUpload,
} from "@/lib/content-runtime/shared";

const createJsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createQueryClient();

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const createPreparedUpload = (
  objectPath: string,
  contentType: string,
): ContentPreparedUpload => ({
  apiUrl: "https://example.supabase.co",
  bucketName: "cms-assets",
  contentType,
  objectPath,
  path: objectPath,
  provider: "supabase_signed",
  publishableKey: "publishable-key",
  token: "signed-upload-token",
});

const createMediaLibrary = (): ContentMediaLibrary => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "cms-assets",
  canManage: true,
  currentPath: "",
  folderOptions: [""],
  folders: [],
  images: [],
  search: "",
  urlExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
});

const createFilesLibrary = (): ContentFilesLibrary => ({
  breadcrumbs: [{ label: "Home", path: "" }],
  bucketName: "cms-assets",
  canManage: true,
  currentPath: "",
  fileCount: 0,
  files: [],
  folderOptions: [""],
  folders: [],
  search: "",
  urlExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
});

describe("managed storage refresh callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateImageUploadFile).mockResolvedValue({
      contentType: "image/png",
    } as never);
    vi.mocked(validateFileUpload).mockResolvedValue({
      contentType: "text/plain",
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("completes media direct uploads and notifies the editor shell after success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/projects/project-1/media?")) {
          return createJsonResponse(createMediaLibrary());
        }

        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );

    vi.mocked(prepareContentRuntimeDirectUploads).mockResolvedValue([
      createPreparedUpload("media/hero.png", "image/png"),
    ]);
    vi.mocked(completeContentRuntimeDirectUploads).mockResolvedValue([
      {
        objectPath: "media/hero.png",
        signedUrl: "https://cdn.example.com/media/hero.png",
      },
    ]);

    const onMediaChanged = vi.fn();
    const { container } = renderWithQueryClient(
      <ProjectMediaManager onMediaChanged={onMediaChanged} projectId="project-1" />,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const input = await waitFor(() => {
      const renderedInput = container.querySelector('input[type="file"]');

      expect(renderedInput).not.toBeNull();

      return renderedInput;
    });

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File(["image-bytes"], "hero.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(completeContentRuntimeDirectUploads).toHaveBeenCalledWith({
        endpoint: "/api/projects/project-1/media",
        objectPaths: ["media/hero.png"],
      });
    });

    await waitFor(() => {
      expect(onMediaChanged).toHaveBeenCalledTimes(1);
    });
  });

  it("completes files direct uploads and notifies the editor shell after success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/projects/project-1/files?")) {
          return createJsonResponse(createFilesLibrary());
        }

        throw new Error(`Unexpected fetch call: ${url}`);
      }),
    );

    vi.mocked(prepareContentRuntimeDirectUploads).mockResolvedValue([
      createPreparedUpload("files/spec.txt", "text/plain"),
    ]);
    vi.mocked(completeContentRuntimeDirectUploads).mockResolvedValue([
      {
        objectPath: "files/spec.txt",
        signedUrl: "https://cdn.example.com/files/spec.txt",
      },
    ]);

    const onFilesChanged = vi.fn();
    const { container } = renderWithQueryClient(
      <ProjectFilesManager onFilesChanged={onFilesChanged} projectId="project-1" />,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const input = await waitFor(() => {
      const renderedInput = container.querySelector('input[type="file"]');

      expect(renderedInput).not.toBeNull();

      return renderedInput;
    });

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File(["spec-bytes"], "spec.txt", { type: "text/plain" })],
      },
    });

    await waitFor(() => {
      expect(completeContentRuntimeDirectUploads).toHaveBeenCalledWith({
        endpoint: "/api/projects/project-1/files",
        objectPaths: ["files/spec.txt"],
      });
    });

    await waitFor(() => {
      expect(onFilesChanged).toHaveBeenCalledTimes(1);
    });
  });

  it("reloads the rebased folder only once after moving the current files folder", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/projects/project-1/files?")) {
        const parsedUrl = new URL(url, "https://example.test");
        const path = parsedUrl.searchParams.get("path") ?? "";

        return createJsonResponse({
          ...createFilesLibrary(),
          currentPath: path,
          folders: path ? [{ fileCount: 0, name: path.split("/").at(-1) ?? path, objectPath: path }] : [],
        });
      }

      if (url.endsWith("/api/projects/project-1/files") && init?.method === "PATCH") {
        return createJsonResponse({
          folderPath: "archive/docs",
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const onFilesChanged = vi.fn();
    const { getByText } = renderWithQueryClient(
      <ProjectFilesManager initialPath="docs" onFilesChanged={onFilesChanged} projectId="project-1" />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/projects/project-1/files?"),
        expect.anything(),
      );
    });

    const getCallsForPath = (path: string) =>
      fetchMock.mock.calls.filter(([input]) => {
        const url = String(input);
        return url.includes("/api/projects/project-1/files?") && url.includes(`path=${encodeURIComponent(path)}`);
      });

    expect(getCallsForPath("docs")).toHaveLength(1);

    fireEvent.click(getByText("move-current-folder"));
    fireEvent.click(getByText("confirm-move-folder"));

    await waitFor(() => {
      expect(onFilesChanged).toHaveBeenCalledTimes(1);
    });

    expect(getCallsForPath("archive/docs")).toHaveLength(1);
  });
});
