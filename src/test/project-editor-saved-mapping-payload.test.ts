import { describe, expect, it } from "vitest";

import { buildProjectEditorSavedMappingPayloadState } from "@/components/editor/project-editor/saved-mapping-payload";
import {
  createDefaultContentMappingConfig,
  type ContentMappingConfig,
  type ContentProjectMapping,
} from "@/lib/content-runtime/mapping";

const createMappingConfig = (): ContentMappingConfig => {
  const mappingConfig = createDefaultContentMappingConfig();

  mappingConfig.entities.posts = {
    ...mappingConfig.entities.posts,
    source: {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    },
  };
  mappingConfig.filesStorage = {
    bucketName: "files",
    endpoint: null,
    provider: "s3_compatible",
    publicUrlBase: null,
    region: "us-east-1",
  };
  mappingConfig.mediaStorage = {
    bucketName: "media",
    endpoint: "https://storage.example.com",
    provider: "supabase_bucket",
    publicUrlBase: "https://cdn.example.com",
    region: null,
  };

  return mappingConfig;
};

const createMappingPayload = (
  overrides: Partial<ContentProjectMapping> = {},
): ContentProjectMapping =>
  ({
    bindingId: "binding-1",
    bindingMode: "mapped_content",
    bindingStatus: "ready",
    detectedSchemaVersion: null,
    id: "mapping-1",
    installStatus: "installed",
    mappingConfig: createMappingConfig(),
    projectId: "project-1",
    revisionId: "revision-1",
    revisionVersion: 1,
    updatedAt: "2026-04-30T00:00:00.000Z",
    ...overrides,
  }) as ContentProjectMapping;

describe("buildProjectEditorSavedMappingPayloadState", () => {
  it("derives saved mapping and storage drafts from a stored mapping payload", () => {
    const state = buildProjectEditorSavedMappingPayloadState({
      ...createMappingPayload(),
      availableSupabaseBuckets: [{ id: "media", isPublic: true, name: "media" }],
      filesStorageCredentialStatus: {
        hasS3AccessKeyId: true,
        hasS3SecretAccessKey: false,
      },
      mediaStorageCredentialStatus: {
        hasS3AccessKeyId: true,
        hasS3SecretAccessKey: true,
      },
    });

    expect(state.availableSupabaseBuckets).toEqual([{ id: "media", isPublic: true, name: "media" }]);
    expect(state.postsEntity).toMatchObject({
      source: {
        kind: "table",
        primaryKey: "id",
        schema: "public",
        table: "posts",
      },
    });
    expect(state.filesStorage).toEqual({
      bucketName: "files",
      endpoint: "",
      hasStoredCredentials: false,
      provider: "s3_compatible",
      publicUrlBase: "",
      region: "us-east-1",
    });
    expect(state.mediaStorage).toEqual({
      bucketName: "media",
      endpoint: "https://storage.example.com",
      hasStoredCredentials: true,
      provider: "supabase_bucket",
      publicUrlBase: "https://cdn.example.com",
      region: "",
    });
  });

  it("returns empty saved storage state when the mapping has no storage config", () => {
    const state = buildProjectEditorSavedMappingPayloadState(
      createMappingPayload({
        mappingConfig: {
          ...createDefaultContentMappingConfig(),
          filesStorage: null,
          mediaStorage: null,
        },
      }),
    );

    expect(state.availableSupabaseBuckets).toEqual([]);
    expect(state.filesStorage).toBeNull();
    expect(state.mediaStorage).toBeNull();
    expect(state.postsEntity).toEqual(createDefaultContentMappingConfig().entities.posts);
  });
});
