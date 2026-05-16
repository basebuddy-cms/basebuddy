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
  createContentMediaFolder,
  deleteContentMediaFolder,
  deleteContentMediaImage,
  getContentUploadedMediaFiles,
  getContentMediaLibrary,
  moveContentMediaFolder,
  moveContentMediaImage,
  prepareContentMediaUploads,
  uploadContentMediaFiles,
} from "@/lib/content-runtime/server";
import type { ContentMediaLibrary } from "@/lib/content-runtime/shared";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  MAX_MEDIA_UPLOAD_FILES,
  MAX_MEDIA_UPLOAD_REQUEST_BYTES,
} from "@/lib/security/upload-validation";

export const runtime = "nodejs";

const mediaFolderActionSchema = z.object({
  action: z.literal("create_folder"),
  folderName: z.string().trim().min(1, "Folder name is required.").max(120, "Folder name must be 120 characters or fewer."),
  parentPath: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
});

const mediaMoveActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move_folder"),
    destinationPath: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
    folderPath: z.string().trim().min(1, "Choose a folder first.").max(1024, "Folder path is too long."),
  }),
  z.object({
    action: z.literal("move_image"),
    destinationPath: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
    objectPath: z.string().trim().min(1, "Choose an image first.").max(1024, "Object path is too long."),
  }),
]);

const mediaDeleteActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete_folder"),
    folderPath: z.string().trim().min(1, "Choose a folder first.").max(1024, "Folder path is too long."),
  }),
  z.object({
    action: z.literal("delete_image"),
    objectPath: z.string().trim().min(1, "Choose an image first.").max(1024, "Object path is too long."),
  }),
]);

const mediaUploadFileSchema = z.object({
  contentType: z.string().trim().max(255, "Content type is too long."),
  name: z.string().trim().min(1, "File name is required.").max(512, "File name is too long."),
  size: z.number().int().positive("File size is required.").max(MAX_MEDIA_UPLOAD_BYTES, "Image upload is too large."),
});

const mediaPostActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare_upload"),
    files: z
      .array(mediaUploadFileSchema)
      .min(1, "Choose at least one image to upload.")
      .max(MAX_MEDIA_UPLOAD_FILES, `Upload ${MAX_MEDIA_UPLOAD_FILES} images or fewer at a time.`),
    path: z.string().trim().max(1024, "Folder path is too long.").nullable().optional(),
  }),
  z.object({
    action: z.literal("complete_upload"),
    objectPaths: z
      .array(z.string().trim().min(1, "Object path is required.").max(1024, "Object path is too long."))
      .min(1, "Choose at least one image to upload.")
      .max(MAX_MEDIA_UPLOAD_FILES, `Upload ${MAX_MEDIA_UPLOAD_FILES} images or fewer at a time.`),
  }),
]);

export const GET = withAuthenticatedProjectRoute(async (request, { projectId }) => {
  const { searchParams } = new URL(request.url);
  const includeFolderOptions = searchParams.get("includeFolderOptions") === "true";

  try {
    const payload = await getContentMediaLibrary({
      currentPath: searchParams.get("path"),
      cursor: searchParams.get("cursor"),
      includeFolderOptions,
      projectId,
      search: searchParams.get("search"),
    });

    return NextResponse.json(payload satisfies ContentMediaLibrary);
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "media");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "media") });
  }
});

export const POST = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const payloadResult = await parseJsonBody(request, mediaPostActionSchema, {
        maxBytes: 64 * 1024,
      });

      if (payloadResult.errorResponse) {
        return payloadResult.errorResponse;
      }

      const payload = payloadResult.data;

      const rateLimitError = enforceRateLimit({
        bucket: "api:project-media:post",
        key: user.id,
        limit: 20,
        request,
        windowMs: 60_000,
      });

      if (rateLimitError) {
        return rateLimitError;
      }

      if (payload.action === "prepare_upload") {
        const uploads = await prepareContentMediaUploads({
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

      const files = await getContentUploadedMediaFiles({
        objectPaths: payload.objectPaths,
        projectId,
        userId: user.id,
      });

      return NextResponse.json({ success: true, files });
    }

    const contentLengthError = enforceContentLength({
      label: "Media upload",
      maxBytes: MAX_MEDIA_UPLOAD_REQUEST_BYTES,
      request,
    });

    if (contentLengthError) {
      return contentLengthError;
    }

    const rateLimitError = enforceRateLimit({
      bucket: "api:project-media:post",
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
      return NextResponse.json({ error: "Choose at least one image to upload." }, { status: 400 });
    }

    if (files.length > MAX_MEDIA_UPLOAD_FILES) {
      return NextResponse.json(
        { error: `Upload ${MAX_MEDIA_UPLOAD_FILES} images or fewer at a time.` },
        { status: 400 },
      );
    }

    const uploaded = await uploadContentMediaFiles({
      files,
      projectId,
      targetPath: String(formData.get("path") ?? ""),
    });

    return NextResponse.json({ success: true, files: uploaded });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "media");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "media") });
  }
});

export const PUT = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, mediaFolderActionSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data;

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-media:put",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    await createContentMediaFolder({
      folderName: payload.folderName ?? "",
      parentPath: payload.parentPath,
      projectId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "media");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "media") });
  }
});

export const PATCH = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, mediaMoveActionSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data;

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-media:patch",
    key: user.id,
    limit: 30,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    if (payload.action === "move_image") {
      const objectPath = await moveContentMediaImage({
        destinationPath: payload.destinationPath,
        objectPath: payload.objectPath ?? "",
        projectId,
      });

      return NextResponse.json({ objectPath, success: true });
    }

    const folderPath = await moveContentMediaFolder({
      destinationPath: payload.destinationPath,
      folderPath: payload.folderPath ?? "",
      projectId,
    });

    return NextResponse.json({ folderPath, success: true });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "media");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "media") });
  }
});

export const DELETE = withAuthenticatedProjectRoute(async (request, { projectId, user }) => {
  const payloadResult = await parseJsonBody(request, mediaDeleteActionSchema, {
    maxBytes: 16 * 1024,
  });

  if (payloadResult.errorResponse) {
    return payloadResult.errorResponse;
  }

  const payload = payloadResult.data;

  const rateLimitError = enforceRateLimit({
    bucket: "api:project-media:delete",
    key: user.id,
    limit: 20,
    request,
    windowMs: 60_000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    if (payload.action === "delete_image") {
      await deleteContentMediaImage({
        objectPath: payload.objectPath ?? "",
        projectId,
      });

      return NextResponse.json({ success: true });
    }

    await deleteContentMediaFolder({
      folderPath: payload.folderPath ?? "",
      projectId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getManagedStorageRouteErrorMessage(error, "media");
    return NextResponse.json({ error: message }, { status: getManagedStorageRouteErrorStatus(message, "media") });
  }
});
