import "server-only";

import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  CONTENT_MEDIA_FOLDER_MARKER,
  isContentImageObject,
  isContentReservedFolderName,
  joinContentMediaPath,
  normalizeContentMediaPath,
} from "./media-library";
import {
  createPresignedS3CompatibleUploadUrl,
  deleteS3CompatibleMediaObjects,
  moveS3CompatibleMediaObject,
  uploadS3CompatibleMediaObject,
  type S3CompatibleMediaStorageConfig,
} from "./s3-compatible-storage";
import { getContentMediaLibraryContext } from "./server-media-context";
import {
  assertPreparedContentUploads,
  getContentManagedMediaObjects,
  getContentManagedMediaUrls,
  getUniqueContentFolderPath,
  getUniqueContentObjectPath,
  registerPreparedContentUpload,
  requireContentManagedStorage,
  type ContentMediaDependencies,
} from "./server-media-shared";
import {
  removeContentMediaObjectPaths,
  type ConnectedProjectStorageClient,
} from "./server-media-supabase";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  validateImageUploadMetadata,
  validateImageUploadFile,
} from "@/lib/security/upload-validation";
import type {
  ContentPreparedUpload,
  ContentUploadedFile,
  ContentUploadFileDescriptor,
} from "@/lib/content-runtime/shared";

const CONTENT_DIRECT_UPLOAD_TTL_SECONDS = 60 * 60 * 2;

export const createContentMediaFolder = async ({
  dependencies,
  folderName,
  parentPath,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  folderName: string;
  parentPath?: string | null;
  projectId: string;
}) => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );

  const normalizedFolderName = folderName.trim();

  if (!normalizedFolderName) {
    throw new Error("Folder name is required.");
  }

  if (/[\\/]/.test(normalizedFolderName)) {
    throw new Error("Folder names cannot contain slashes.");
  }

  if (isContentReservedFolderName(normalizedFolderName)) {
    throw new Error("Choose a different folder name.");
  }

  const normalizedParentPath = normalizeContentMediaPath(parentPath);
  const targetFolderPath = joinContentMediaPath(normalizedParentPath, normalizedFolderName);
  const markerPath = joinContentMediaPath(targetFolderPath, CONTENT_MEDIA_FOLDER_MARKER);

  if (mediaContext.provider === "s3_compatible") {
    await uploadS3CompatibleMediaObject({
      body: new Uint8Array([]),
      config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
      contentType: "text/plain;charset=UTF-8",
      objectPath: markerPath,
    });
    return;
  }

  const { error } = await (mediaContext.storage as ConnectedProjectStorageClient).storage
    .from(mediaContext.bucketName)
    .upload(markerPath, new Uint8Array([]), {
      contentType: "text/plain;charset=UTF-8",
      upsert: false,
    });

  if (error) {
    throw new Error(getProductionErrorMessage(error, "Could not create that folder right now."));
  }
};

export const uploadContentMediaFiles = async ({
  dependencies,
  files,
  projectId,
  targetPath,
}: {
  dependencies: ContentMediaDependencies;
  files: File[];
  projectId: string;
  targetPath?: string | null;
}): Promise<{ objectPath: string; signedUrl: string }[]> => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );

  if (!files.length) {
    throw new Error("Choose at least one image to upload.");
  }

  const normalizedTargetPath = normalizeContentMediaPath(targetPath);
  const existingPaths = new Set(
    (await getContentManagedMediaObjects({
      dependencies,
      mediaContext,
    })).map((record) => record.objectPath),
  );

  const uploadedPaths: string[] = [];

  for (const file of files) {
    const objectPath = getUniqueContentObjectPath(existingPaths, normalizedTargetPath, file.name);
    const validatedFile = await validateImageUploadFile({
      file,
      label: file.name || "Image upload",
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
    });
    if (mediaContext.provider === "s3_compatible") {
      await uploadS3CompatibleMediaObject({
        body: validatedFile.bytes,
        config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
        contentType: validatedFile.contentType,
        objectPath,
      });
    } else {
      const { error } = await (mediaContext.storage as ConnectedProjectStorageClient).storage
        .from(mediaContext.bucketName)
        .upload(objectPath, validatedFile.bytes, {
          contentType: validatedFile.contentType,
          upsert: false,
        });

      if (error) {
        throw new Error(getProductionErrorMessage(error, `Could not upload ${file.name} right now.`));
      }
    }

    uploadedPaths.push(objectPath);
  }

  const signedUrls = await getContentManagedMediaUrls({
    mediaContext,
    objectPaths: uploadedPaths,
  });

  return uploadedPaths.map((objectPath) => ({
    objectPath,
    signedUrl: signedUrls.get(objectPath) ?? "",
  }));
};

export const prepareContentMediaUploads = async ({
  dependencies,
  files,
  projectId,
  targetPath,
  userId,
}: {
  dependencies: ContentMediaDependencies;
  files: ContentUploadFileDescriptor[];
  projectId: string;
  targetPath?: string | null;
  userId: string;
}): Promise<ContentPreparedUpload[]> => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );

  if (!files.length) {
    throw new Error("Choose at least one image to upload.");
  }

  const normalizedTargetPath = normalizeContentMediaPath(targetPath);
  const existingPaths = new Set(
    (await getContentManagedMediaObjects({
      dependencies,
      mediaContext,
    })).map((record) => record.objectPath),
  );
  const preparedUploads: ContentPreparedUpload[] = [];

  for (const file of files) {
    const validatedUpload = validateImageUploadMetadata({
      contentType: file.contentType,
      fileName: file.name,
      label: file.name || "Image upload",
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
      sizeBytes: file.size,
    });
    const objectPath = getUniqueContentObjectPath(existingPaths, normalizedTargetPath, file.name);
    registerPreparedContentUpload({
      kind: "media",
      objectPath,
      projectId,
      userId,
    });

    if (mediaContext.provider === "s3_compatible") {
      preparedUploads.push({
        contentType: validatedUpload.contentType,
        headers: {
          "Content-Type": validatedUpload.contentType,
        },
        objectPath,
        provider: "s3_compatible",
        uploadUrl: createPresignedS3CompatibleUploadUrl({
          config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
          objectPath,
          ttlSeconds: CONTENT_DIRECT_UPLOAD_TTL_SECONDS,
        }),
      });
      continue;
    }

    const publishableKey = mediaContext.context.publishableKey?.trim();

    if (!publishableKey) {
      throw new Error(
        "Could not prepare direct uploads. Check the storage configuration and try again.",
      );
    }

    const { data, error } = await (mediaContext.storage as ConnectedProjectStorageClient).storage
      .from(mediaContext.bucketName)
      .createSignedUploadUrl(objectPath);

    if (error || !data?.token) {
      throw new Error(
        getProductionErrorMessage(error, `Could not prepare ${file.name} for upload right now.`),
      );
    }

    preparedUploads.push({
      apiUrl: mediaContext.context.apiUrl as string,
      bucketName: mediaContext.bucketName,
      contentType: validatedUpload.contentType,
      objectPath,
      path: objectPath,
      provider: "supabase_signed",
      publishableKey,
      token: data.token,
    });
  }

  return preparedUploads;
};

export const getContentUploadedMediaFiles = async ({
  dependencies,
  objectPaths,
  projectId,
  userId,
}: {
  dependencies: ContentMediaDependencies;
  objectPaths: string[];
  projectId: string;
  userId: string;
}): Promise<ContentUploadedFile[]> => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );
  const normalizedObjectPaths = [...new Set(objectPaths.map((value) => normalizeContentMediaPath(value)).filter(Boolean))];

  if (!normalizedObjectPaths.length) {
    throw new Error("Choose at least one image to upload.");
  }

  assertPreparedContentUploads({
    kind: "media",
    objectPaths: normalizedObjectPaths,
    projectId,
    userId,
  });

  const signedUrls = await getContentManagedMediaUrls({
    mediaContext,
    objectPaths: normalizedObjectPaths,
  });

  return normalizedObjectPaths.map((objectPath) => ({
    objectPath,
    signedUrl: signedUrls.get(objectPath) ?? "",
  }));
};

export const moveContentMediaImage = async ({
  dependencies,
  destinationPath,
  objectPath,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  destinationPath?: string | null;
  objectPath: string;
  projectId: string;
}) => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );

  const normalizedObjectPath = normalizeContentMediaPath(objectPath);
  const normalizedDestinationPath = normalizeContentMediaPath(destinationPath);

  if (!normalizedObjectPath) {
    throw new Error("Choose an image first.");
  }

  const records = await getContentManagedMediaObjects({
    dependencies,
    mediaContext,
  });
  const targetRecord = records.find((record) => record.objectPath === normalizedObjectPath);

  if (!targetRecord || !isContentImageObject(targetRecord)) {
    throw new Error("Could not find that image in the media library.");
  }

  const targetFileName = normalizedObjectPath.split("/").pop() ?? normalizedObjectPath;
  const existingPaths = new Set(
    records.map((record) => record.objectPath).filter((path) => path !== normalizedObjectPath),
  );
  const nextObjectPath = getUniqueContentObjectPath(existingPaths, normalizedDestinationPath, targetFileName);

  if (nextObjectPath === normalizedObjectPath) {
    return;
  }

  if (mediaContext.provider === "s3_compatible") {
    await moveS3CompatibleMediaObject({
      config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
      destinationObjectPath: nextObjectPath,
      sourceObjectPath: normalizedObjectPath,
    });
  } else {
    const { error } = await (mediaContext.storage as ConnectedProjectStorageClient).storage
      .from(mediaContext.bucketName)
      .move(normalizedObjectPath, nextObjectPath);

    if (error) {
      throw new Error(getProductionErrorMessage(error, "Could not move that image right now."));
    }
  }

  return nextObjectPath;
};

export const moveContentMediaFolder = async ({
  dependencies,
  destinationPath,
  folderPath,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  destinationPath?: string | null;
  folderPath: string;
  projectId: string;
}) => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );

  const normalizedFolderPath = normalizeContentMediaPath(folderPath);
  const normalizedDestinationPath = normalizeContentMediaPath(destinationPath);

  if (!normalizedFolderPath) {
    throw new Error("Choose a folder first.");
  }

  if (
    normalizedDestinationPath === normalizedFolderPath ||
    normalizedDestinationPath.startsWith(`${normalizedFolderPath}/`)
  ) {
    throw new Error("Choose a different destination folder.");
  }

  const records = await getContentManagedMediaObjects({
    dependencies,
    mediaContext,
  });
  const folderRecords = records
    .filter((record) => record.objectPath.startsWith(`${normalizedFolderPath}/`))
    .sort((left, right) => left.objectPath.localeCompare(right.objectPath));

  if (!folderRecords.length) {
    throw new Error("Could not find that folder in the media library.");
  }

  const folderName = normalizedFolderPath.split("/").pop() ?? normalizedFolderPath;
  const existingPaths = new Set(
    records.map((record) => record.objectPath).filter((path) => !path.startsWith(`${normalizedFolderPath}/`)),
  );
  const nextFolderPath = getUniqueContentFolderPath(existingPaths, normalizedDestinationPath, folderName);

  if (nextFolderPath === normalizedFolderPath) {
    return nextFolderPath;
  }

  for (const record of folderRecords) {
    const relativePath = record.objectPath.slice(normalizedFolderPath.length + 1);
    const nextObjectPath = joinContentMediaPath(nextFolderPath, relativePath);
    if (mediaContext.provider === "s3_compatible") {
      await moveS3CompatibleMediaObject({
        config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
        destinationObjectPath: nextObjectPath,
        sourceObjectPath: record.objectPath,
      });
    } else {
      const { error } = await (mediaContext.storage as ConnectedProjectStorageClient).storage
        .from(mediaContext.bucketName)
        .move(record.objectPath, nextObjectPath);

      if (error) {
        throw new Error(getProductionErrorMessage(error, "Could not move that folder right now."));
      }
    }
  }

  return nextFolderPath;
};

export const deleteContentMediaImage = async ({
  dependencies,
  objectPath,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  objectPath: string;
  projectId: string;
}) => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );

  const normalizedObjectPath = normalizeContentMediaPath(objectPath);

  if (!normalizedObjectPath) {
    throw new Error("Choose an image first.");
  }

  const records = await getContentManagedMediaObjects({
    dependencies,
    mediaContext,
  });
  const targetRecord = records.find((record) => record.objectPath === normalizedObjectPath);

  if (!targetRecord || !isContentImageObject(targetRecord)) {
    throw new Error("Could not find that image in the media library.");
  }

  if (mediaContext.provider === "s3_compatible") {
    await deleteS3CompatibleMediaObjects({
      config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
      objectPaths: [normalizedObjectPath],
    });
    return;
  }

  await removeContentMediaObjectPaths({
    bucketName: mediaContext.bucketName,
    objectPaths: [normalizedObjectPath],
    storage: mediaContext.storage as ConnectedProjectStorageClient,
  });
};

export const deleteContentMediaFolder = async ({
  dependencies,
  folderPath,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  folderPath: string;
  projectId: string;
}) => {
  const mediaContext = requireContentManagedStorage(
    await getContentMediaLibraryContext({
      dependencies,
      projectId,
    }),
  );

  const normalizedFolderPath = normalizeContentMediaPath(folderPath);

  if (!normalizedFolderPath) {
    throw new Error("Choose a folder first.");
  }

  const records = await getContentManagedMediaObjects({
    dependencies,
    mediaContext,
  });
  const folderObjectPaths = records
    .filter((record) => record.objectPath.startsWith(`${normalizedFolderPath}/`))
    .map((record) => record.objectPath);

  if (!folderObjectPaths.length) {
    throw new Error("Could not find that folder in the media library.");
  }

  if (mediaContext.provider === "s3_compatible") {
    await deleteS3CompatibleMediaObjects({
      config: mediaContext.s3Storage as S3CompatibleMediaStorageConfig,
      objectPaths: folderObjectPaths,
    });
    return;
  }

  await removeContentMediaObjectPaths({
    bucketName: mediaContext.bucketName,
    objectPaths: folderObjectPaths,
    storage: mediaContext.storage as ConnectedProjectStorageClient,
  });
};
