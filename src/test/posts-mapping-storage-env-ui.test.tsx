import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorPostsMappingMediaStorageStep } from "@/components/editor/project-editor/posts-mapping-wizard";
import type { PostsMediaStorageDraft } from "@/components/editor/project-editor/types";

const createStorageDraft = (
  overrides: Partial<PostsMediaStorageDraft> = {},
): PostsMediaStorageDraft => ({
  bucketName: "media-assets",
  endpoint: "https://storage.example.com",
  hasStoredCredentials: false,
  provider: "s3_compatible",
  publicUrlBase: "",
  region: "auto",
  ...overrides,
});

describe("posts mapping storage env UI", () => {
  it("does not ask users to enter S3 access keys in the mapping wizard", () => {
    render(
      <ProjectEditorPostsMappingMediaStorageStep
        availableSupabaseBuckets={[]}
        filesStorage={createStorageDraft({
          bucketName: "file-assets",
        })}
        mediaStorage={createStorageDraft()}
        onBucketNameChange={vi.fn()}
        onEndpointChange={vi.fn()}
        onFilesBucketNameChange={vi.fn()}
        onFilesEndpointChange={vi.fn()}
        onFilesProviderChange={vi.fn()}
        onFilesPublicUrlBaseChange={vi.fn()}
        onFilesRegionChange={vi.fn()}
        onProviderChange={vi.fn()}
        onPublicUrlBaseChange={vi.fn()}
        onRegionChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Access Key ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Secret Access Key")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Upload storage credentials are managed in app configuration/i),
    ).toHaveLength(2);
  });
});
