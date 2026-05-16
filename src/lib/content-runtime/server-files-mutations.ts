import "server-only";

import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  CONTENT_MEDIA_FOLDER_MARKER,
  isContentFileObject,
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
import { getContentFilesLibraryContext } from "./server-files-context";
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
  MAX_FILE_UPLOAD_BYTES,
  validateFileUploadMetadata,
  validateFileUpload,
} from "@/lib/security/upload-validation";
import type {
  ContentPreparedUpload,
  ContentUploadedFile,
  ContentUploadFileDescriptor,
} from "@/lib/content-runtime/shared";

const CONTENT_DIRECT_UPLOAD_TTL_SECONDS = 60 * 60 * 2;

export const createContentFilesFolder = async ({
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
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
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

  if (filesContext.provider === "s3_compatible") {
    await uploadS3CompatibleMediaObject({
      body: new Uint8Array([]),
      config: filesContext.s3Storage as S3CompatibleMediaStorageConfig,
      contentType: "text/plain;charset=UTF-8",
      objectPath: markerPath,
    });
    return;
  }

  const { error } = await (filesContext.storage as ConnectedProjectStorageClient).storage
    .from(filesContext.bucketName)
    .upload(markerPath, new Uint8Array([]), {
      contentType: "text/plain;charset=UTF-8",
      upsert: false,
    });

  if (error) {
    throw new Error(getProductionErrorMessage(error, "Could not create that folder right now."));
  }
};

export const uploadContentFiles = async ({
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
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
      dependencies,
      projectId,
    }),
  );

  if (!files.length) {
    throw new Error("Choose at least one file to upload.");
  }

  const normalizedTargetPath = normalizeContentMediaPath(targetPath);
  const existingPaths = new Set(
    (await getContentManagedMediaObjects({
      dependencies,
      mediaContext: filesContext,
    })).map((record) => record.objectPath),
  );

  const uploadedPaths: string[] = [];

  for (const file of files) {
    const objectPath = getUniqueContentObjectPath(existingPaths, normalizedTargetPath, file.name);
    const validatedFile = await validateFileUpload({
      file,
      label: file.name || "File upload",
      maxBytes: MAX_FILE_UPLOAD_BYTES,
    });

    if (filesContext.provider === "s3_compatible") {
      await uploadS3CompatibleMediaObject({
        body: validatedFile.bytes,
        config: filesContext.s3Storage as S3CompatibleMediaStorageConfig,
        contentType: validatedFile.contentType,
        objectPath,
      });
    } else {
      const { error } = await (filesContext.storage as ConnectedProjectStorageClient).storage
        .from(filesContext.bucketName)
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
    mediaContext: filesContext,
    objectPaths: uploadedPaths,
  });

  return uploadedPaths.map((objectPath) => ({
    objectPath,
    signedUrl: signedUrls.get(objectPath) ?? "",
  }));
};

export const prepareContentFilesUploads = async ({
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
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
      dependencies,
      projectId,
    }),
  );

  if (!files.length) {
    throw new Error("Choose at least one file to upload.");
  }

  const normalizedTargetPath = normalizeContentMediaPath(targetPath);
  const existingPaths = new Set(
    (await getContentManagedMediaObjects({
      dependencies,
      mediaContext: filesContext,
    })).map((record) => record.objectPath),
  );
  const preparedUploads: ContentPreparedUpload[] = [];

  for (const file of files) {
    const validatedUpload = validateFileUploadMetadata({
      contentType: file.contentType,
      fileName: file.name,
      label: file.name || "File upload",
      maxBytes: MAX_FILE_UPLOAD_BYTES,
      sizeBytes: file.size,
    });
    const objectPath = getUniqueContentObjectPath(existingPaths, normalizedTargetPath, file.name);
    registerPreparedContentUpload({
      kind: "files",
      objectPath,
      projectId,
      userId,
    });

    if (filesContext.provider === "s3_compatible") {
      preparedUploads.push({
        contentType: validatedUpload.contentType,
        headers: {
          "Content-Type": validatedUpload.contentType,
        },
        objectPath,
        provider: "s3_compatible",
        uploadUrl: createPresignedS3CompatibleUploadUrl({
          config: filesContext.s3Storage as S3CompatibleMediaStorageConfig,
          objectPath,
          ttlSeconds: CONTENT_DIRECT_UPLOAD_TTL_SECONDS,
        }),
      });
      continue;
    }

    const publishableKey = filesContext.context.publishableKey?.trim();

    if (!publishableKey) {
      throw new Error(
        "Could not prepare direct uploads. Check the storage configuration and try again.",
      );
    }

    const { data, error } = await (filesContext.storage as ConnectedProjectStorageClient).storage
      .from(filesContext.bucketName)
      .createSignedUploadUrl(objectPath);

    if (error || !data?.token) {
      throw new Error(
        getProductionErrorMessage(error, `Could not prepare ${file.name} for upload right now.`),
      );
    }

    preparedUploads.push({
      apiUrl: filesContext.context.apiUrl as string,
      bucketName: filesContext.bucketName,
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

export const getContentUploadedFiles = async ({
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
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
      dependencies,
      projectId,
    }),
  );
  const normalizedObjectPaths = [...new Set(objectPaths.map((value) => normalizeContentMediaPath(value)).filter(Boolean))];

  if (!normalizedObjectPaths.length) {
    throw new Error("Choose at least one file to upload.");
  }

  assertPreparedContentUploads({
    kind: "files",
    objectPaths: normalizedObjectPaths,
    projectId,
    userId,
  });

  const signedUrls = await getContentManagedMediaUrls({
    mediaContext: filesContext,
    objectPaths: normalizedObjectPaths,
  });

  return normalizedObjectPaths.map((objectPath) => ({
    objectPath,
    signedUrl: signedUrls.get(objectPath) ?? "",
  }));
};

export const moveContentFile = async ({
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
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
      dependencies,
      projectId,
    }),
  );

  const normalizedObjectPath = normalizeContentMediaPath(objectPath);
  const normalizedDestinationPath = normalizeContentMediaPath(destinationPath);

  if (!normalizedObjectPath) {
    throw new Error("Choose a file first.");
  }

  const records = await getContentManagedMediaObjects({
    dependencies,
    mediaContext: filesContext,
  });
  const targetRecord = records.find((record) => record.objectPath === normalizedObjectPath);

  if (!targetRecord || !isContentFileObject(targetRecord)) {
    throw new Error("Could not find that file in the files library.");
  }

  const targetFileName = normalizedObjectPath.split("/").pop() ?? normalizedObjectPath;
  const existingPaths = new Set(
    records.map((record) => record.objectPath).filter((path) => path !== normalizedObjectPath),
  );
  const nextObjectPath = getUniqueContentObjectPath(existingPaths, normalizedDestinationPath, targetFileName);

  if (nextObjectPath === normalizedObjectPath) {
    return;
  }

  if (filesContext.provider === "s3_compatible") {
    await moveS3CompatibleMediaObject({
      config: filesContext.s3Storage as S3CompatibleMediaStorageConfig,
      destinationObjectPath: nextObjectPath,
      sourceObjectPath: normalizedObjectPath,
    });
  } else {
    const { error } = await (filesContext.storage as ConnectedProjectStorageClient).storage
      .from(filesContext.bucketName)
      .move(normalizedObjectPath, nextObjectPath);

    if (error) {
      throw new Error(getProductionErrorMessage(error, "Could not move that file right now."));
    }
  }

  return nextObjectPath;
};

export const moveContentFilesFolder = async ({
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
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
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
    mediaContext: filesContext,
  });
  const folderRecords = records
    .filter((record) => record.objectPath.startsWith(`${normalizedFolderPath}/`))
    .sort((left, right) => left.objectPath.localeCompare(right.objectPath));

  if (!folderRecords.length) {
    throw new Error("Could not find that folder in the files library.");
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

    if (filesContext.provider === "s3_compatible") {
      await moveS3CompatibleMediaObject({
        config: filesContext.s3Storage as S3CompatibleMediaStorageConfig,
        destinationObjectPath: nextObjectPath,
        sourceObjectPath: record.objectPath,
      });
    } else {
      const { error } = await (filesContext.storage as ConnectedProjectStorageClient).storage
        .from(filesContext.bucketName)
        .move(record.objectPath, nextObjectPath);

      if (error) {
        throw new Error(getProductionErrorMessage(error, "Could not move that folder right now."));
      }
    }
  }

  return nextFolderPath;
};

export const deleteContentFile = async ({
  dependencies,
  objectPath,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  objectPath: string;
  projectId: string;
}) => {
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
      dependencies,
      projectId,
    }),
  );

  const normalizedObjectPath = normalizeContentMediaPath(objectPath);

  if (!normalizedObjectPath) {
    throw new Error("Choose a file first.");
  }

  const records = await getContentManagedMediaObjects({
    dependencies,
    mediaContext: filesContext,
  });
  const targetRecord = records.find((record) => record.objectPath === normalizedObjectPath);

  if (!targetRecord || !isContentFileObject(targetRecord)) {
    throw new Error("Could not find that file in the files library.");
  }

  if (filesContext.provider === "s3_compatible") {
    await deleteS3CompatibleMediaObjects({
      config: filesContext.s3Storage as S3CompatibleMediaStorageConfig,
      objectPaths: [normalizedObjectPath],
    });
    return;
  }

  await removeContentMediaObjectPaths({
    bucketName: filesContext.bucketName,
    objectPaths: [normalizedObjectPath],
    storage: filesContext.storage as ConnectedProjectStorageClient,
  });
};

export const deleteContentFilesFolder = async ({
  dependencies,
  folderPath,
  projectId,
}: {
  dependencies: ContentMediaDependencies;
  folderPath: string;
  projectId: string;
}) => {
  const filesContext = requireContentManagedStorage(
    await getContentFilesLibraryContext({
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
    mediaContext: filesContext,
  });
  const folderObjectPaths = records
    .filter((record) => record.objectPath.startsWith(`${normalizedFolderPath}/`))
    .map((record) => record.objectPath);

  if (!folderObjectPaths.length) {
    throw new Error("Could not find that folder in the files library.");
  }

  if (filesContext.provider === "s3_compatible") {
    await deleteS3CompatibleMediaObjects({
      config: filesContext.s3Storage as S3CompatibleMediaStorageConfig,
      objectPaths: folderObjectPaths,
    });
    return;
  }

  await removeContentMediaObjectPaths({
    bucketName: filesContext.bucketName,
    objectPaths: folderObjectPaths,
    storage: filesContext.storage as ConnectedProjectStorageClient,
  });
};
