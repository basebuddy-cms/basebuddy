import React, { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/editor/project-editor/posts-mapping-controls", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/components/editor/project-editor/posts-mapping-controls")
  >();

  return {
    ...actual,
    ProjectEditorPostsMappingRow: () => <div data-testid="mapping-row" />,
  };
});

import { ProjectEditorPostsMappingWorkspace } from "@/components/editor/project-editor/posts-mapping-workspace";
import type { MappingDetectionPayload } from "@/components/editor/project-editor/types";
import type { ContentIntrospectedTable } from "@/lib/content-runtime/introspection";
import {
  createDefaultContentMappingConfig,
  type ContentRelationMapping,
  type ContentEntityMapping,
  type ContentMappingConfig,
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
      dataType: "uuid",
      defaultValue: null,
      enumValues: null,
      isArray: false,
      isJson: false,
      isNullable: true,
      name: "author_id",
      udtName: "uuid",
    },
  ],
  foreignKeys: [
    {
      column: "author_id",
      targetColumn: "id",
      targetSchema: "public",
      targetTable: "pw_existing_authors",
    },
  ],
  kind: "table",
  name: "posts",
  primaryKey: "id",
  rowCountEstimate: 12,
  sampleRows: [
    {
      author_id: "author-1",
      body_html: "<p>Hello world</p>",
      id: "post-1",
      slug: "hello-world",
      title: "Hello world",
    },
  ],
  schema: "public",
});

const createTextColumn = (name: string): ContentIntrospectedTable["columns"][number] => ({
  dataType: "text",
  defaultValue: null,
  enumValues: null,
  isArray: false,
  isJson: false,
  isNullable: true,
  name,
  udtName: "text",
});

const createIdColumn = (): ContentIntrospectedTable["columns"][number] => ({
  dataType: "uuid",
  defaultValue: null,
  enumValues: null,
  isArray: false,
  isJson: false,
  isNullable: false,
  name: "id",
  udtName: "uuid",
});

const createAuthorsTable = (): ContentIntrospectedTable => ({
  columns: [
    createIdColumn(),
    createTextColumn("name"),
    createTextColumn("slug"),
    createTextColumn("email"),
    createTextColumn("bio"),
  ],
  foreignKeys: [],
  kind: "table",
  name: "pw_existing_authors",
  primaryKey: "id",
  rowCountEstimate: 3,
  sampleRows: [],
  schema: "public",
});

const createCategoriesTable = (): ContentIntrospectedTable => ({
  columns: [
    createIdColumn(),
    createTextColumn("name"),
    createTextColumn("slug"),
    createTextColumn("description"),
    createTextColumn("parent_category_id"),
  ],
  foreignKeys: [],
  kind: "table",
  name: "pw_existing_categories",
  primaryKey: "id",
  rowCountEstimate: 3,
  sampleRows: [],
  schema: "public",
});

const createTagsTable = (): ContentIntrospectedTable => ({
  columns: [
    createIdColumn(),
    createTextColumn("name"),
    createTextColumn("slug"),
    createTextColumn("description"),
  ],
  foreignKeys: [],
  kind: "table",
  name: "pw_existing_tags",
  primaryKey: "id",
  rowCountEstimate: 3,
  sampleRows: [],
  schema: "public",
});

const createPostCategoriesJoinTable = (): ContentIntrospectedTable => ({
  columns: [createIdColumn(), createIdColumn(), createIdColumn()].map((column, index) =>
    index === 0
      ? { ...column, name: "id" }
      : index === 1
        ? { ...column, name: "post_id" }
        : { ...column, name: "category_id" },
  ),
  foreignKeys: [
    {
      column: "post_id",
      targetColumn: "id",
      targetSchema: "public",
      targetTable: "posts",
    },
    {
      column: "category_id",
      targetColumn: "id",
      targetSchema: "public",
      targetTable: "pw_existing_categories",
    },
  ],
  kind: "table",
  name: "pw_existing_post_categories",
  primaryKey: "id",
  rowCountEstimate: 6,
  sampleRows: [],
  schema: "public",
});

const createPostTagsJoinTable = (): ContentIntrospectedTable => ({
  columns: [createIdColumn(), createIdColumn(), createIdColumn()].map((column, index) =>
    index === 0
      ? { ...column, name: "id" }
      : index === 1
        ? { ...column, name: "post_id" }
        : { ...column, name: "tag_id" },
  ),
  foreignKeys: [
    {
      column: "post_id",
      targetColumn: "id",
      targetSchema: "public",
      targetTable: "posts",
    },
    {
      column: "tag_id",
      targetColumn: "id",
      targetSchema: "public",
      targetTable: "pw_existing_tags",
    },
  ],
  kind: "table",
  name: "pw_existing_post_tags",
  primaryKey: "id",
  rowCountEstimate: 8,
  sampleRows: [],
  schema: "public",
});

const createDetectedMappingConfig = (): ContentMappingConfig => {
  const config = createDefaultContentMappingConfig();

  config.entities.posts = createMappedPostsEntity();
  config.entities.posts.relations.authors = {
    fieldMap: {},
    junctionSourceColumn: null,
    junctionTable: null,
    junctionTargetColumn: null,
    multiple: false,
    sourceColumn: "author_id",
    status: "mapped",
    strategy: "foreign_key",
    targetColumn: "id",
    targetEntity: "authors",
    targetTable: "pw_existing_authors",
    valueColumn: null,
  } satisfies ContentRelationMapping;
  config.entities.posts.relations.categories = {
    fieldMap: {},
    junctionSourceColumn: "post_id",
    junctionTable: "pw_existing_post_categories",
    junctionTargetColumn: "category_id",
    multiple: true,
    sourceColumn: null,
    status: "mapped",
    strategy: "join_table",
    targetColumn: "id",
    targetEntity: "categories",
    targetTable: "pw_existing_categories",
    valueColumn: null,
  } satisfies ContentRelationMapping;
  config.entities.posts.relations.tags = {
    fieldMap: {},
    junctionSourceColumn: "post_id",
    junctionTable: "pw_existing_post_tags",
    junctionTargetColumn: "tag_id",
    multiple: true,
    sourceColumn: null,
    status: "mapped",
    strategy: "join_table",
    targetColumn: "id",
    targetEntity: "tags",
    targetTable: "pw_existing_tags",
    valueColumn: null,
  } satisfies ContentRelationMapping;

  config.entities.authors.status = "mapped";
  config.entities.authors.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: "pw_existing_authors",
  };
  config.entities.authors.fields.id.column = "id";
  config.entities.authors.fields.name.column = "name";
  config.entities.authors.fields.slug.column = "slug";
  config.entities.authors.fields.email.column = "email";
  config.entities.authors.fields.bio.column = "bio";

  config.entities.categories.status = "mapped";
  config.entities.categories.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: "pw_existing_categories",
  };
  config.entities.categories.fields.id.column = "id";
  config.entities.categories.fields.name.column = "name";
  config.entities.categories.fields.slug.column = "slug";
  config.entities.categories.fields.description.column = "description";
  config.entities.categories.fields.parentId.column = "parent_category_id";

  config.entities.tags.status = "mapped";
  config.entities.tags.source = {
    kind: "table",
    primaryKey: "id",
    schema: "public",
    table: "pw_existing_tags",
  };
  config.entities.tags.fields.id.column = "id";
  config.entities.tags.fields.name.column = "name";
  config.entities.tags.fields.slug.column = "slug";
  config.entities.tags.fields.description.column = "description";

  return config;
};

const createMappingDetectionPayload = (): MappingDetectionPayload => {
  const suggestedMappingConfig = createDetectedMappingConfig();
  const candidatePreview = {
    columns: [],
    rows: [],
    values: {},
  };

  return {
    candidates: {
      authors: [
        {
          confidence: 0.95,
          entity: "authors",
          label: "pw_existing_authors",
          mapping: suggestedMappingConfig.entities.authors,
          reasons: ["Detected from authors table"],
          samplePreview: candidatePreview,
        },
      ],
      categories: [
        {
          confidence: 0.95,
          entity: "categories",
          label: "pw_existing_categories",
          mapping: suggestedMappingConfig.entities.categories,
          reasons: ["Detected from categories table"],
          samplePreview: candidatePreview,
        },
      ],
      files: [],
      media: [],
      posts: [
        {
          confidence: 0.99,
          entity: "posts",
          label: "posts",
          mapping: suggestedMappingConfig.entities.posts,
          reasons: ["Detected from posts table"],
          samplePreview: candidatePreview,
        },
      ],
      tags: [
        {
          confidence: 0.95,
          entity: "tags",
          label: "pw_existing_tags",
          mapping: suggestedMappingConfig.entities.tags,
          reasons: ["Detected from tags table"],
          samplePreview: candidatePreview,
        },
      ],
    },
    generatedAt: "2026-03-30T00:00:00.000Z",
    suggestedMappingConfig,
    tables: [
      createPostsTable(),
      createAuthorsTable(),
      createCategoriesTable(),
      createTagsTable(),
      createPostCategoriesJoinTable(),
      createPostTagsJoinTable(),
    ],
  };
};

const createSparseMappingDetectionPayload = (): MappingDetectionPayload => {
  const payload = createMappingDetectionPayload();
  const sparsePostsTable = {
    ...createPostsTable(),
    foreignKeys: [],
  };

  return {
    ...payload,
    tables: [sparsePostsTable, createAuthorsTable(), createCategoriesTable(), createTagsTable()],
  };
};

const createAlternateAuthorsDetectionPayload = (): MappingDetectionPayload => {
  const payload = createMappingDetectionPayload();
  const alternateAuthorsTable = {
    ...createAuthorsTable(),
    name: "legacy_authors",
  };
  const alternatePostsTable = {
    ...createPostsTable(),
    foreignKeys: [
      {
        column: "author_id",
        targetColumn: "id",
        targetSchema: "public",
        targetTable: "legacy_authors",
      },
    ],
  };

  return {
    ...payload,
    candidates: {
      ...payload.candidates,
      authors: [
        {
          ...payload.candidates.authors[0]!,
          label: "legacy_authors",
          mapping: {
            ...payload.candidates.authors[0]!.mapping,
            source: {
              ...payload.candidates.authors[0]!.mapping.source,
              table: "legacy_authors",
            },
          },
        },
      ],
      posts: [
        {
          ...payload.candidates.posts[0]!,
          mapping: {
            ...payload.candidates.posts[0]!.mapping,
            relations: {
              ...payload.candidates.posts[0]!.mapping.relations,
              authors: {
                ...payload.candidates.posts[0]!.mapping.relations.authors!,
                targetTable: "legacy_authors",
              },
            },
          },
        },
      ],
    },
    suggestedMappingConfig: {
      ...payload.suggestedMappingConfig,
      entities: {
        ...payload.suggestedMappingConfig.entities,
        authors: {
          ...payload.suggestedMappingConfig.entities.authors,
          source: {
            ...payload.suggestedMappingConfig.entities.authors.source,
            table: "legacy_authors",
          },
        },
        posts: {
          ...payload.suggestedMappingConfig.entities.posts,
          relations: {
            ...payload.suggestedMappingConfig.entities.posts.relations,
            authors: {
              ...payload.suggestedMappingConfig.entities.posts.relations.authors!,
              targetTable: "legacy_authors",
            },
          },
        },
      },
    },
    tables: [
      alternatePostsTable,
      alternateAuthorsTable,
      createCategoriesTable(),
      createTagsTable(),
      createPostCategoriesJoinTable(),
      createPostTagsJoinTable(),
    ],
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

function MappingScopeHarness({
  availableSupabaseBuckets = [],
  entryCollection,
  loadingSavedMapping = false,
  mappingDetection = createMappingDetectionPayload(),
  onSaveMapping,
  savedMappingConfig = null,
}: {
  availableSupabaseBuckets?: Array<{ id: string; isPublic: boolean; name: string }>;
  entryCollection: "Authors" | "Categories" | "Files" | "Media" | "Posts" | "Tags";
  loadingSavedMapping?: boolean;
  mappingDetection?: MappingDetectionPayload | null;
  onSaveMapping: (input: {
    mappingConfig: ContentMappingConfig;
  }) => Promise<void>;
  savedMappingConfig?: ContentMappingConfig | null;
}) {
  const finishHandlerRef = useRef<(() => Promise<void>) | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void finishHandlerRef.current?.();
        }}
      >
        Save mapping
      </button>
      <ProjectEditorPostsMappingWorkspace
        currentProjectName="Demo Project"
        loadingMappingDetection={false}
        loadingMappingTableCatalog={false}
        loadingSavedMapping={loadingSavedMapping}
        manualMappingTableRef="public.posts"
        mappingDetection={mappingDetection}
        mappingDetectionError={null}
        mappingDetectionMode="auto"
        mappingEntryCollection={entryCollection}
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
        onSaveMapping={onSaveMapping}
        postsMappingStepIndex={0}
        savingPostsMapping={false}
        savedMappingError={null}
        selectedDetectedMapping={createMappedPostsEntity()}
        settingsSavedFilesStorage={null}
        settingsSavedMappingConfig={savedMappingConfig}
        settingsSavedMediaStorage={null}
        settingsSavedPostsEntity={savedMappingConfig?.entities.posts ?? null}
        settingsAvailableSupabaseBuckets={availableSupabaseBuckets}
      />
    </div>
  );
}

describe("posts mapping workspace save scope", () => {
  it("shows only the media storage section in the media flow", () => {
    render(<MappingScopeHarness entryCollection="Media" onSaveMapping={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByRole("heading", { level: 2, name: "Media Storage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Files Storage" })).not.toBeInTheDocument();
  });

  it("shows only the files storage section in the files flow", () => {
    render(<MappingScopeHarness entryCollection="Files" onSaveMapping={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByRole("heading", { level: 2, name: "Files Storage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Media Storage" })).not.toBeInTheDocument();
  });

  it("does not auto-map posts when saving media storage during the initial draft", async () => {
    const onSaveMapping = vi.fn().mockResolvedValue(undefined);

    render(<MappingScopeHarness entryCollection="Media" onSaveMapping={onSaveMapping} />);

    fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() => {
      expect(onSaveMapping).toHaveBeenCalledTimes(1);
    });

    const savedConfig = onSaveMapping.mock.calls[0]?.[0]?.mappingConfig as ContentMappingConfig;

    expect(savedConfig.entities.posts.status).toBe(
      createDefaultContentMappingConfig().entities.posts.status,
    );
    expect(savedConfig.entities.posts.source.table).toBeNull();
  });

  it("shows a loading state while saved mapping data is still loading for relation flows", () => {
    render(
      <MappingScopeHarness
        entryCollection="Tags"
        loadingSavedMapping={true}
        onSaveMapping={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("Loading saved mapping data.")).toBeInTheDocument();
  });

  it("prefills the suggested media bucket when media storage is still unmapped", async () => {
    const onSaveMapping = vi.fn().mockResolvedValue(undefined);

    render(
      <MappingScopeHarness
        availableSupabaseBuckets={[
          { id: "uploads", isPublic: false, name: "Uploads" },
          { id: "post-images", isPublic: false, name: "Post Images" },
        ]}
        entryCollection="Media"
        onSaveMapping={onSaveMapping}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() => {
      expect(onSaveMapping).toHaveBeenCalledTimes(1);
    });

    const savedConfig = onSaveMapping.mock.calls[0]?.[0]?.mappingConfig as ContentMappingConfig;
    expect(savedConfig.mediaStorage).toEqual(
      expect.objectContaining({
        bucketName: "post-images",
        provider: "supabase_bucket",
      }),
    );
  });

  it.each([
    {
      collection: "Authors" as const,
      relationKey: "authors" as const,
      table: "pw_existing_authors",
    },
    {
      collection: "Categories" as const,
      relationKey: "categories" as const,
      table: "pw_existing_categories",
    },
    {
      collection: "Tags" as const,
      relationKey: "tags" as const,
      table: "pw_existing_tags",
    },
  ])(
    "prefills and saves the $collection relation mapping from detection when only posts are currently saved",
    async ({ collection, relationKey, table }) => {
      const onSaveMapping = vi.fn().mockResolvedValue(undefined);
      const savedMappingConfig = createDefaultContentMappingConfig();
      savedMappingConfig.entities.posts = createMappedPostsEntity();

      render(
        <MappingScopeHarness
          entryCollection={collection}
          onSaveMapping={onSaveMapping}
          savedMappingConfig={savedMappingConfig}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));

      await waitFor(() => {
        expect(onSaveMapping).toHaveBeenCalledTimes(1);
      });

      const savedConfig = onSaveMapping.mock.calls[0]?.[0]?.mappingConfig as ContentMappingConfig;

      expect(savedConfig.entities[relationKey].status).toBe("mapped");
      expect(savedConfig.entities[relationKey].source.table).toBe(table);
      expect(savedConfig.entities.posts.relations[relationKey]?.status).toBe("mapped");
    },
  );

  it.each([
    {
      collection: "Authors" as const,
      relationKey: "authors" as const,
      table: "pw_existing_authors",
    },
    {
      collection: "Categories" as const,
      relationKey: "categories" as const,
      table: "pw_existing_categories",
    },
    {
      collection: "Tags" as const,
      relationKey: "tags" as const,
      table: "pw_existing_tags",
    },
  ])(
    "falls back to the suggested $collection relation mapping when raw table metadata is incomplete",
    async ({ collection, relationKey, table }) => {
      const onSaveMapping = vi.fn().mockResolvedValue(undefined);
      const savedMappingConfig = createDefaultContentMappingConfig();
      savedMappingConfig.entities.posts = createMappedPostsEntity();

      render(
        <MappingScopeHarness
          entryCollection={collection}
          mappingDetection={createSparseMappingDetectionPayload()}
          onSaveMapping={onSaveMapping}
          savedMappingConfig={savedMappingConfig}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));

      await waitFor(() => {
        expect(onSaveMapping).toHaveBeenCalledTimes(1);
      });

      const savedConfig = onSaveMapping.mock.calls[0]?.[0]?.mappingConfig as ContentMappingConfig;

      expect(savedConfig.entities[relationKey].status).toBe("mapped");
      expect(savedConfig.entities[relationKey].source.table).toBe(table);
      expect(savedConfig.entities.posts.relations[relationKey]?.status).toBe("mapped");
    },
  );

  it("resets the relation draft when the detection payload changes", async () => {
    const firstSave = vi.fn().mockResolvedValue(undefined);
    const savedMappingConfig = createDefaultContentMappingConfig();
    savedMappingConfig.entities.posts = createMappedPostsEntity();

    const { rerender } = render(
      <MappingScopeHarness
        entryCollection="Authors"
        mappingDetection={createMappingDetectionPayload()}
        onSaveMapping={firstSave}
        savedMappingConfig={savedMappingConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() => {
      expect(firstSave).toHaveBeenCalledTimes(1);
    });

    const secondSave = vi.fn().mockResolvedValue(undefined);

    rerender(
      <MappingScopeHarness
        entryCollection="Authors"
        mappingDetection={createAlternateAuthorsDetectionPayload()}
        onSaveMapping={secondSave}
        savedMappingConfig={savedMappingConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save mapping" }));

    await waitFor(() => {
      expect(secondSave).toHaveBeenCalledTimes(1);
    });

    const savedConfig = secondSave.mock.calls[0]?.[0]?.mappingConfig as ContentMappingConfig;

    expect(savedConfig.entities.authors.source.table).toBe("legacy_authors");
    expect(savedConfig.entities.posts.relations.authors?.targetTable).toBe("public.legacy_authors");
  });
});
