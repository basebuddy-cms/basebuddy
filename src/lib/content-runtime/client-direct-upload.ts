"use client";

import { createDirectUploadStorageClient } from "./adapter/storage-clients";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import type { ContentPreparedUpload } from "./shared";

const getS3UploadErrorMessage = async (response: Response) => {
  const rawBody = await response.text().catch(() => "");
  const match = rawBody.match(/<Message>([\s\S]*?)<\/Message>/i);

  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  return "Could not upload that file right now.";
};

export const uploadPreparedContentRuntimeFile = async ({
  file,
  upload,
}: {
  file: File;
  upload: ContentPreparedUpload;
}) => {
  if (upload.provider === "supabase_signed") {
    const storageClient = createDirectUploadStorageClient(upload.apiUrl, upload.publishableKey);
    const uploadBody =
      file.type === upload.contentType ? file : new File([file], file.name, { type: upload.contentType });
    const { error } = await storageClient.storage
      .from(upload.bucketName)
      .uploadToSignedUrl(upload.path, upload.token, uploadBody);

    if (error) {
      throw new Error(getProductionErrorMessage(error, "Could not upload that file right now."));
    }

    return;
  }

  try {
    const response = await fetch(upload.uploadUrl, {
      body: file,
      headers: upload.headers,
      method: "PUT",
    });

    if (!response.ok) {
      throw new Error(await getS3UploadErrorMessage(response));
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Could not upload directly to storage. Check media storage access and allowed origins for this site.",
      );
    }

    throw error;
  }
};
