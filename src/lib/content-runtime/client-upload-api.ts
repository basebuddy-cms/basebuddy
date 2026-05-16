"use client";

import type {
  ContentPreparedUpload,
  ContentUploadedFile,
  ContentUploadFileDescriptor,
} from "./shared";

type PrepareUploadsResponse = {
  error?: string;
  success?: boolean;
  uploads?: ContentPreparedUpload[];
};

type CompleteUploadsResponse = {
  error?: string;
  files?: ContentUploadedFile[];
  success?: boolean;
};

export const prepareContentRuntimeDirectUploads = async ({
  endpoint,
  files,
  path,
}: {
  endpoint: string;
  files: ContentUploadFileDescriptor[];
  path?: string | null;
}) => {
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      action: "prepare_upload",
      files,
      path: path ?? "",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as PrepareUploadsResponse;

  if (!response.ok || !payload.success || !payload.uploads) {
    throw new Error(payload.error ?? "Could not prepare those uploads right now.");
  }

  return payload.uploads;
};

export const completeContentRuntimeDirectUploads = async ({
  endpoint,
  objectPaths,
}: {
  endpoint: string;
  objectPaths: string[];
}) => {
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      action: "complete_upload",
      objectPaths,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as CompleteUploadsResponse;

  if (!response.ok || !payload.success || !payload.files) {
    throw new Error(payload.error ?? "Could not finish those uploads right now.");
  }

  return payload.files;
};
