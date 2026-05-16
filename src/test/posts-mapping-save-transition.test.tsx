import React, { useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const wizardSpy = vi.fn();

vi.mock("@/components/editor/project-editor/posts-mapping-wizard", async () => {
  const actual = await vi.importActual<typeof import("@/components/editor/project-editor/posts-mapping-wizard")>(
    "@/components/editor/project-editor/posts-mapping-wizard",
  );

  return {
    ...actual,
    ProjectEditorPostsMappingCustomFieldsStep: () => null,
    ProjectEditorPostsMappingMediaStorageStep: () => null,
    ProjectEditorPostsMappingWizard: (props: {
      savingMessages?: Array<{ detail: string; title: string }> | null;
    }) => {
      wizardSpy(props);

      return (
        <div data-testid="mapping-save-transition">
          {props.savingMessages?.map((message) => (
            <div key={message.title}>
              <h2>{message.title}</h2>
              <p>{message.detail}</p>
            </div>
          )) ?? null}
        </div>
      );
    },
  };
});

vi.mock("@/components/editor/project-editor/posts-mapping-controls", () => ({
  ProjectEditorPostsMappingRow: () => <div data-testid="mapping-row" />,
}));

import { ProjectEditorPostsMappingWorkspace } from "@/components/editor/project-editor/posts-mapping-workspace";
import type { MappingDetectionPayload } from "@/components/editor/project-editor/types";
import type { ContentIntrospectedTable } from "@/lib/content-runtime/introspection";
import {
  createDefaultContentMappingConfig,
  type ContentEntityMapping,
} from "@/lib/content-runtime/mapping";

const createPostsTable = (): ContentIntrospectedTable => ({
  columns: [
    {
      dataType: "uuid",
      defaultValue: null,
      enumValues: null,
      isArray: false,
      isJson: false,
      isNullable: false,
      name: "id",
      udtName: "uuid",
    },
    {
      dataType: "text",
      defaultValue: null,
      enumValues: null,
      isArray: false,
      isJson: false,
      isNullable: false,
      name: "title",
      udtName: "text",
    },
    {
      dataType: "text",
      defaultValue: null,
      enumValues: null,
      isArray: false,
      isJson: false,
      isNullable: true,
      name: "slug",
      udtName: "text",
    },
    {
      dataType: "text",
      defaultValue: null,
      enumValues: null,
      isArray: false,
      isJson: false,
      isNullable: true,
      name: "body_html",
      udtName: "text",
    },
    {
      dataType: "text",
      defaultValue: null,
      enumValues: null,
      isArray: false,
      isJson: false,
      isNullable: true,
      name: "featured_image_url",
      udtName: "text",
    },
  ],
  foreignKeys: [],
  kind: "table",
  name: "posts",
  primaryKey: "id",
  rowCountEstimate: 12,
  sampleRows: [
    {
      body_html: "<p>Hello world</p>",
      featured_image_url: "https://example.com/image.jpg",
      id: "post-1",
      slug: "hello-world",
      title: "Hello world",
    },
  ],
  schema: "public",
});

const createMappingDetectionPayload = (): MappingDetectionPayload => {
  const suggestedMappingConfig = createDefaultContentMappingConfig();
  suggestedMappingConfig.entities.posts = createMappedPostsEntity();

  return {
    candidates: {
      authors: [],
      categories: [],
      files: [],
      media: [],
      posts: [],
      tags: [],
    },
    generatedAt: "2026-03-30T00:00:00.000Z",
    suggestedMappingConfig,
    tables: [createPostsTable()],
  };
};

const createMappedPostsEntity = (): ContentEntityMapping => {
  const mapping = createDefaultContentMappingConfig().entities.posts;

  mapping.status = "mapped";
  mapping.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: "posts",
  };
  mapping.fields.id.column = "id";
  mapping.fields.title.column = "title";
  mapping.fields.slug.column = "slug";
  mapping.fields.featuredImageUrl.column = "featured_image_url";
  mapping.editorFields = [
    {
      column: "body_html",
      id: "body_html",
      kind: "html",
      label: "Body",
      placeholder: null,
      required: false,
      visible: true,
    },
  ];

  return mapping;
};

function WorkspaceHarness({
  settingsSavedPostsEntity = null,
}: {
  settingsSavedPostsEntity?: ContentEntityMapping | null;
}) {
  const [savingPostsMapping, setSavingPostsMapping] = useState(false);
  const finishHandlerRef = useRef<(() => Promise<void>) | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void finishHandlerRef.current?.();
        }}
      >
        Start mapping save
      </button>
      <ProjectEditorPostsMappingWorkspace
        currentProjectName="Demo Project"
        loadingMappingDetection={false}
        loadingMappingTableCatalog={false}
        loadingSavedMapping={false}
        manualMappingTableRef="public.posts"
        mappingDetection={createMappingDetectionPayload()}
        mappingDetectionError={null}
        mappingDetectionMode="auto"
        mappingEntryCollection="Posts"
        mappingSelectedTableRef={null}
        mappingTableCatalog={[]}
        mappingTableCatalogError={null}
        onManualMappingTableRefChange={vi.fn()}
        onPostsMappingStepIndexChange={vi.fn()}
        onRegisterFinishHandler={(handler) => {
          finishHandlerRef.current = handler;
        }}
        onRequestManualMappingDetection={vi.fn()}
        onRequestMappingConfirm={vi.fn()}
        onSaveMapping={async () => {
          setSavingPostsMapping(true);
          await new Promise(() => undefined);
        }}
        postsMappingStepIndex={0}
        savingPostsMapping={savingPostsMapping}
        savedMappingError={null}
        selectedDetectedMapping={createMappedPostsEntity()}
        settingsAvailableSupabaseBuckets={[]}
        settingsSavedFilesStorage={null}
        settingsSavedMappingConfig={null}
        settingsSavedMediaStorage={null}
        settingsSavedPostsEntity={settingsSavedPostsEntity}
      />
    </div>
  );
}

describe("posts mapping save transition", () => {
  it("shows first-time mapping copy while saving a new mapping", async () => {
    render(<WorkspaceHarness />);

    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Start mapping save" }));

    await waitFor(() => {
      expect(screen.getAllByRole("heading").map((element) => element.textContent)).toEqual([
        "Saving content mapping",
        "Checking post fields",
        "Checking related content",
        "Refreshing editor",
        "Opening Demo Project",
      ]);
    });
    expect(screen.getByText("Saving the connected post mapping.")).toBeInTheDocument();
    expect(screen.getByText("Checking featured images for this mapping.")).toBeInTheDocument();
  });

  it("shows update-specific copy while saving an edited mapping", async () => {
    render(<WorkspaceHarness settingsSavedPostsEntity={createMappedPostsEntity()} />);

    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Start mapping save" }));

    await waitFor(() => {
      expect(screen.getAllByRole("heading").map((element) => element.textContent)).toEqual([
        "Saving mapping changes",
        "Checking updated fields",
        "Checking related content",
        "Refreshing editor",
        "Opening Demo Project",
      ]);
    });
    expect(screen.getByText("Reviewing title, slug, and content fields.")).toBeInTheDocument();
    expect(screen.getByText("Checking featured images for this mapping.")).toBeInTheDocument();
  });
});
