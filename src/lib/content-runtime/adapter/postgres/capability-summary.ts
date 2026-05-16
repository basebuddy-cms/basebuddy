import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";

import type { ContentAdapterCapabilitySummary } from "../contracts";
import type { ContentCompiledAdapterMapping } from "../compiler";
import { createStorageLibraryState } from "../storage-library-state";
import { buildContentAdapterFieldSpecs } from "./field-specs";
import { buildContentAdapterSidebarFieldSpecs } from "./sidebar-field-specs";

type ContentAdapterCapabilitySummaryInput = {
  compiled: ContentCompiledAdapterMapping;
  hasFilesS3CompatibleCredentials: boolean;
  hasS3CompatibleCredentials: boolean;
  mapping: ContentProjectMapping;
};

export const buildContentAdapterCapabilitySummary = ({
  compiled,
  hasFilesS3CompatibleCredentials,
  hasS3CompatibleCredentials,
  mapping,
}: ContentAdapterCapabilitySummaryInput): ContentAdapterCapabilitySummary => {
  const config = mapping.mappingConfig;
  const posts = config.entities.posts;
  const enabledCustomFields = (posts.customFields ?? []).filter((field) => field.enabled);
  const filesStorage = config.filesStorage
    ? createStorageLibraryState({
        bucketName: config.filesStorage.bucketName,
        hasCredentials: hasFilesS3CompatibleCredentials,
        provider: config.filesStorage.provider,
      })
    : null;
  const mediaStorage = config.mediaStorage
    ? createStorageLibraryState({
        bucketName: config.mediaStorage.bucketName,
        hasCredentials: hasS3CompatibleCredentials,
        provider: config.mediaStorage.provider,
      })
    : null;

  return {
    customFields: enabledCustomFields,
    editorFields: (posts.editorFields ?? [])
      .filter((field) => field.visible && field.column)
      .map((field) => ({ id: field.id, label: field.label, required: field.required })),
    fieldSpecs: buildContentAdapterFieldSpecs({
      compiled,
      mapping,
    }),
    filesStorage,
    mediaStorage,
    sidebarFieldSpecs: buildContentAdapterSidebarFieldSpecs({
      compiled,
      mapping,
    }),
  };
};
