import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceContentLength,
  enforceRateLimit,
  parseJsonBody,
} from "@/lib/api/request-guards";
import {
  getManagedStorageRouteErrorMessage,
  getManagedStorageRouteErrorStatus,
} from "@/lib/api/project-managed-storage-route-errors";
import { withAuthenticatedProjectRoute } from "@/lib/api/project-api-auth";
import {
  createContentFilesFolder,
  deleteContentFile,
  deleteContentFilesFolder,
  getContentUploadedFiles,
  getContentFilesLibrary,
  moveContentFile,
  moveContentFilesFolder,
  prepareContentFilesUploads,
  uploadContentFiles,
} from "@/lib/content-runtime/server";
import type { ContentFilesLibrary } from "@/lib/content-runtime/shared";
import {
  MAX_FILE_UPLOAD_BYTES,
  MAX_FILE_UPLOAD_FILES,
  MAX_FILE_UPLOAD_REQUEST_BYTES,
} from "@/lib/security/upload-validation";

export const runtime = "nodejs";

const filesFolderActionSchema = z.object({
  action: z.literal("create_folder"),
  folderName: z.string().trim().min(1, "Folder name is required.").max(120, "Folder name must be 120 characters or fewer."),
  parentPath: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
});

const filesMoveActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move_file"),
    destinationPath: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
    objectPath: z.string().trim().min(1, "Choose a file first.").max(1024, "Object path is too long."),
  }),
  z.object({
    action: z.literal("move_folder"),
    destinationPath: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
    folderPath: z.string().trim().min(1, "Choose a folder first.").max(1024, "Folder path is too long."),
  }),
]);

const filesDeleteActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete_file"),
    objectPath: z.string().trim().min(1, "Choose a file first.").max(1024, "Object path is too long."),
  }),
  z.object({
    action: z.literal("delete_folder"),
    folderPath: z.string().trim().min(1, "Choose a folder first.").max(1024, "Folder path is too long."),
  }),
]);

const filesUploadFileSchema = z.object({
  contentType: z.string().trim().max(255, "Content type is too long."),
  name: z.string().trim().min(1, "File name is required.").max(512, "File name is too long."),
  size: z.number().int().positive("File size is required.").max(MAX_FILE_UPLOAD_BYTES, "File upload is too large."),
});

const filesPostActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare_upload"),
    files: z
      .array(filesUploadFileSchema)
      .min(1, "Choose at least one file to upload.")
      .max(MAX_FILE_UPLOAD_FILES, `Upload ${MAX_FILE_UPLOAD_FILES} files or fewer at a time.`),
    path: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
  }),
  z.object({
    action: z.literal("complete_upload"),
    objectPaths: z
      .array(z.string().trim().min(1, "Object path is required.").max(1024, "Object path is too long."))
      .min(1, "Choose at least one file to upload.")
      .max(MAX_FILE_UPLOAD_FILES, `Upload ${MAX_FILE_UPLOAD_FILES} files or fewer at a time.`),
  }),
]);

export const GET = withAuthenticatedProjectRoute(async (request, { projectId }) => {
  const { searchParams } = new URL(request.url);
  const includeFolderOptions = searchParams.get("includeFolderOptions") === "true";

  try {
    const payload = await getContentFilesLibrary({
      currentPath: searchParams.get("path"),
      cursor: searchParams.get("cursor"),
      includeFolderOptions,
      projectId,
      search: searchParams.get("search"),
    });

    return NextResponse.json(payload satisfies ContentFilesLibrary);
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "files");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "files") });
  }
});

export const POST = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const payloadResult = await parseJsonBody(request, filesPostActionSchema, {
        maxBytes: 64 * 1024,
      });

      if (payloadResult.errorResponse) {
        return payloadResult.errorResponse;
      }

      const payload = payloadResult.data;

      const rateLimitError = enforceRateLimit({
        bucket: "api:project-files:post",
        key: user.id,
        limit: 20,
        request,
        windowMs: 60_000,
      });

      if (rateLimitError) {
        return rateLimitError;
      }

      if (payload.action === "prepare_upload") {
        const uploads = await prepareContentFilesUploads({
          files: payload.files.map((file) => ({
            contentType: file.contentType ?? "",
            name: file.name ?? "",
            size: file.size ?? 0,
          })),
          projectId,
          targetPath: payload.path,
          userId: user.id,
        });

        return NextResponse.json({ success: true, uploads });
      }

      const files = await getContentUploadedFiles({
        objectPaths: payload.objectPaths,
        projectId,
        userId: user.id,
      });

      return NextResponse.json({ success: true, files });
    }

    const contentLengthError = enforceContentLength({
      label: "Files upload",
      maxBytes: MAX_FILE_UPLOAD_REQUEST_BYTES,
      request,
    });

    if (contentLengthError) {
      return contentLengthError;
    }

    const rateLimitError = enforceRateLimit({
      bucket: "api:project-files:post",
      key: user.id,
      limit: 20,
      request,
      windowMs: 60_000,
    });

    if (rateLimitError) {
      return rateLimitError;
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!files.length) {
      return NextResponse.json({ error: "Choose at least one file to upload." }, { status: 400 });
    }

    if (files.length > MAX_FILE_UPLOAD_FILES) {
      return NextResponse.json(
        { error: `Upload ${MAX_FILE_UPLOAD_FILES} files or fewer at a time.` },
        { status: 400 },
      );
    }

    const uploaded = await uploadContentFiles({
      files,
      projectId,
      targetPath: String(formData.get("path") ?? ""),
    });

    return NextResponse.json({ success: true, files: uploaded });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "files");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "files") });
  }
});

export const PUT = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, filesFolderActionSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data;

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-files:put",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    await createContentFilesFolder({
      folderName: payload.folderName ?? "",
      parentPath: payload.parentPath,
      projectId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "files");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "files") });
  }
});

export const PATCH = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, filesMoveActionSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data;

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-files:patch",
    key: user.id,
    limit: 30,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    if (payload.action === "move_file") {
      const objectPath = await moveContentFile({
        destinationPath: payload.destinationPath,
        objectPath: payload.objectPath ?? "",
        projectId,
      });

      return NextResponse.json({ objectPath, success: true });
    }

    const folderPath = await moveContentFilesFolder({
      destinationPath: payload.destinationPath,
      folderPath: payload.folderPath ?? "",
      projectId,
    });

    return NextResponse.json({ folderPath, success: true });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "files");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "files") });
  }
});

export const DELETE = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, filesDeleteActionSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data;

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-files:delete",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    if (payload.action === "delete_file") {
      await deleteContentFile({
        objectPath: payload.objectPath ?? "",
        projectId,
      });

      return NextResponse.json({ success: true });
    }

    await deleteContentFilesFolder({
      folderPath: payload.folderPath ?? "",
      projectId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "files");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "files") });
  }
});
