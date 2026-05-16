import { describe, expect, it } from "vitest";

import {
  defaultFilesStorageDraft,
  defaultMediaStorageDraft,
  POSTS_MAPPING_NONE_VALUE,
} from "@/components/editor/project-editor/constants";
import { createProjectEditorPostsMappingConfigBuilder } from "@/components/editor/project-editor/posts-mapping-config";
import { createProjectEditorPostsMappingSupport } from "@/components/editor/project-editor/posts-mapping-support";
import type {
  MappingDetectionPayload,
  PostsMappingDraftState,
  PostsMappingRelationDraft,
} from "@/components/editor/project-editor/types";
import type { ContentIntrospectedTable } from "@/lib/content-runtime/introspection";
import { buildContentAutoMappingResult } from "@/lib/content-runtime/introspection";
import { createDefaultContentMappingConfig } from "@/lib/content-runtime/mapping";

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
      name: "intro_html",
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
      name: "outro_html",
      udtName: "text",
    },
    {
      dataType: "text",
      defaultValue: null,
      enumValues: null,
      isArray: false,
      isJson: false,
      isNullable: true,
      name: "body_markdown",
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
      body_html: "<p>Body</p>",
      body_markdown: "Body",
      id: "post-1",
      intro_html: "<p>Intro</p>",
      outro_html: "<p>Outro</p>",
      title: "Hello World",
    },
  ],
  schema: "public",
});

const createEmptyRelationDraft = (): PostsMappingRelationDraft => ({
  column: POSTS_MAPPING_NONE_VALUE,
  displayColumns: [POSTS_MAPPING_NONE_VALUE],
  fieldMap: {},
  joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
  joinTableRef: POSTS_MAPPING_NONE_VALUE,
  joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
  strategy: "missing",
  targetColumn: POSTS_MAPPING_NONE_VALUE,
  targetTableRef: POSTS_MAPPING_NONE_VALUE,
  valueColumn: POSTS_MAPPING_NONE_VALUE,
});

const createMappingDetectionPayload = (): MappingDetectionPayload => ({
  candidates: {
    authors: [],
    categories: [],
    files: [],
    media: [],
    posts: [],
    tags: [],
  },
  generatedAt: "2026-03-24T00:00:00.000Z",
  suggestedMappingConfig: createDefaultContentMappingConfig(),
  tables: [createPostsTable()],
});

const createRelationAwareMappingDetectionPayload = (): MappingDetectionPayload => {
  const result = buildContentAutoMappingResult({
    tables: [
      {
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
          { column: "author_id", targetColumn: "id", targetSchema: "public", targetTable: "authors" },
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
            title: "Hello world",
          },
        ],
        schema: "public",
      },
      {
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
            name: "name",
            udtName: "text",
          },
          {
            dataType: "text",
            defaultValue: null,
            enumValues: null,
            isArray: false,
            isJson: false,
            isNullable: true,
            name: "email",
            udtName: "text",
          },
        ],
        foreignKeys: [],
        kind: "table",
        name: "authors",
        primaryKey: "id",
        rowCountEstimate: 4,
        sampleRows: [{ email: "author@example.com", id: "author-1", name: "Author" }],
        schema: "public",
      },
      {
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
            name: "name",
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
        ],
        foreignKeys: [],
        kind: "table",
        name: "categories",
        primaryKey: "id",
        rowCountEstimate: 4,
        sampleRows: [{ id: "category-1", name: "News", slug: "news" }],
        schema: "public",
      },
      {
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
            name: "name",
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
        ],
        foreignKeys: [],
        kind: "table",
        name: "tags",
        primaryKey: "id",
        rowCountEstimate: 4,
        sampleRows: [{ id: "tag-1", name: "Launch", slug: "launch" }],
        schema: "public",
      },
      {
        columns: [
          {
            dataType: "uuid",
            defaultValue: null,
            enumValues: null,
            isArray: false,
            isJson: false,
            isNullable: false,
            name: "post_id",
            udtName: "uuid",
          },
          {
            dataType: "uuid",
            defaultValue: null,
            enumValues: null,
            isArray: false,
            isJson: false,
            isNullable: false,
            name: "category_id",
            udtName: "uuid",
          },
        ],
        foreignKeys: [
          { column: "post_id", targetColumn: "id", targetSchema: "public", targetTable: "posts" },
          { column: "category_id", targetColumn: "id", targetSchema: "public", targetTable: "categories" },
        ],
        kind: "table",
        name: "post_categories",
        primaryKey: null,
        rowCountEstimate: 10,
        sampleRows: [],
        schema: "public",
      },
      {
        columns: [
          {
            dataType: "uuid",
            defaultValue: null,
            enumValues: null,
            isArray: false,
            isJson: false,
            isNullable: false,
            name: "post_id",
            udtName: "uuid",
          },
          {
            dataType: "uuid",
            defaultValue: null,
            enumValues: null,
            isArray: false,
            isJson: false,
            isNullable: false,
            name: "tag_id",
            udtName: "uuid",
          },
        ],
        foreignKeys: [
          { column: "post_id", targetColumn: "id", targetSchema: "public", targetTable: "posts" },
          { column: "tag_id", targetColumn: "id", targetSchema: "public", targetTable: "tags" },
        ],
        kind: "table",
        name: "post_tags",
        primaryKey: null,
        rowCountEstimate: 10,
        sampleRows: [],
        schema: "public",
      },
    ],
  });

  return {
    ...result,
    error: undefined,
  };
};

const createMappingDetectionPayloadForTable = (
  table: ContentIntrospectedTable,
): MappingDetectionPayload => ({
  candidates: {
    authors: [],
    categories: [],
    files: [],
    media: [],
    posts: [],
    tags: [],
  },
  generatedAt: "2026-03-24T00:00:00.000Z",
  suggestedMappingConfig: createDefaultContentMappingConfig(),
  tables: [table],
});

const createDraft = (): PostsMappingDraftState => ({
  archivedValues: [],
  author: createEmptyRelationDraft(),
  categories: createEmptyRelationDraft(),
  contentColumns: ["intro_html", "body_html", "outro_html"],
  contentFieldOptions: [
    { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
  ],
  contentColumnKinds: ["html", "html", "html"],
  contentKind: "html",
  createdAtColumn: POSTS_MAPPING_NONE_VALUE,
  customFields: [],
  draftValues: [],
  excerptColumn: POSTS_MAPPING_NONE_VALUE,
  featuredImageUrlColumn: POSTS_MAPPING_NONE_VALUE,
  fieldOptions: {
    contentColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    createdAtColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    excerptColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    featuredImageUrlColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    focusKeywordColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    idColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    publishedAtColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    redirectsColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    seoDescriptionColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    seoTitleColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    slugColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    statusColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    titleColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
    updatedAtColumn: { arrayItemIndex: "1", jsonPath: "", relatedColumns: [POSTS_MAPPING_NONE_VALUE], relatedTableRef: POSTS_MAPPING_NONE_VALUE },
  },
  filesStorage: defaultFilesStorageDraft(),
  focusKeywordColumn: POSTS_MAPPING_NONE_VALUE,
  idColumn: "id",
  legacyCompanionContentColumns: [
    { column: "body_html", kind: "html" },
    { column: "body_markdown", kind: "markdown" },
  ],
  mediaStorage: defaultMediaStorageDraft(),
  publishedAtColumn: POSTS_MAPPING_NONE_VALUE,
  publishedValues: [],
  redirectsColumn: POSTS_MAPPING_NONE_VALUE,
  seoDescriptionColumn: POSTS_MAPPING_NONE_VALUE,
  seoTitleColumn: POSTS_MAPPING_NONE_VALUE,
  slugColumn: POSTS_MAPPING_NONE_VALUE,
  statusBooleanMode: "true_is_published",
  statusColumn: POSTS_MAPPING_NONE_VALUE,
  tableRef: "public.posts",
  tags: createEmptyRelationDraft(),
  titleColumn: "title",
  updatedAtColumn: POSTS_MAPPING_NONE_VALUE,
});

describe("posts mapping content fields", () => {
  it("loads multiple mapped content fields from detected mapping into the draft", () => {
    const mappingDetection = createMappingDetectionPayload();
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const mapping = createDefaultContentMappingConfig().entities.posts;

    mapping.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    mapping.status = "mapped";
    mapping.fields.id.column = "id";
    mapping.fields.title.column = "title";
    mapping.editorFields = [
      { column: "intro_html", id: "intro_html", kind: "html", label: "Intro", placeholder: null, required: true, visible: true },
      { column: "body_html", id: "body_html", kind: "html", label: "Body", placeholder: null, required: false, visible: true },
      { column: "outro_html", id: "outro_html", kind: "html", label: "Outro", placeholder: null, required: false, visible: true },
    ];
    mapping.companionContentColumns = [{ column: "body_markdown", kind: "markdown" }];

    const draft = support.createPostsMappingDraftFromDetectedMapping(mapping);

    expect(draft.contentColumns).toEqual(["intro_html", "body_html", "outro_html"]);
    expect(draft.contentKind).toBe("html");
    expect(draft.legacyCompanionContentColumns).toEqual([{ column: "body_markdown", kind: "markdown" }]);
  });

  it("preserves saved helper-row-backed content fields when rebuilding mapping config", () => {
    const mappingDetection = createMappingDetectionPayload();
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const posts = defaultMappingConfig.entities.posts;
    const postsTable = mappingDetection.tables[0];

    posts.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    posts.status = "mapped";
    posts.fields.id.column = "id";
    posts.fields.title.column = "title";
    posts.editorFields = [
      {
        column: null,
        id: "content_helper",
        kind: "html",
        label: "Content",
        placeholder: null,
        required: true,
        sourceRelation: {
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_content_helper",
          sourceColumn: null,
          strategy: "related_row_by_post_id",
          targetColumn: null,
          targetTable: null,
          valueColumn: "body_html",
        },
        visible: true,
      } as never,
    ];

    const draft = support.createPostsMappingDraftFromDetectedMapping(posts);
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(config?.entities.posts.editorFields).toEqual([
      expect.objectContaining({
        id: "content_helper",
        sourceRelation: {
          junctionSourceColumn: "post_id",
          junctionTable: "public.post_content_helper",
          sourceColumn: null,
          strategy: "related_row_by_post_id",
          targetColumn: null,
          targetTable: null,
          valueColumn: "body_html",
        },
      }),
    ]);
  });

  it("stores ordered content fields as editor fields and does not mirror them as companion columns", () => {
    const mappingDetection = createMappingDetectionPayload();
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = createDraft();
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(config?.entities.posts.editorFields.map((field) => field.column)).toEqual([
      "intro_html",
      "body_html",
      "outro_html",
    ]);
    expect(config?.entities.posts.editorFields.map((field) => field.kind)).toEqual(["html", "html", "html"]);
    expect(config?.entities.posts.editorFields.map((field) => field.required)).toEqual([true, false, false]);
    expect(config?.entities.posts.companionContentColumns).toEqual([{ column: "body_markdown", kind: "markdown" }]);
  });

  it("preserves mixed content formats for each mapped content field", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          name: "intro_html",
          udtName: "text",
        },
        {
          dataType: "text",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: false,
          isNullable: true,
          name: "body_markdown",
          udtName: "text",
        },
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          body_markdown: "## Heading\n\nBody copy",
          id: "post-1",
          intro_html: "<p>Intro copy</p>",
          title: "Mixed content",
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = support.createPostsMappingDraftFromTable("public.posts");
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(
      config?.entities.posts.editorFields.map((field) => ({
        column: field.column,
        kind: field.kind,
      })),
    ).toEqual(
      expect.arrayContaining([
        { column: "intro_html", kind: "html" },
        { column: "body_markdown", kind: "markdown" },
      ]),
    );
  });

  it("stores and reloads non-direct content field selections on shared source columns", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          dataType: "jsonb",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: true,
          isNullable: true,
          name: "content_payload",
          udtName: "jsonb",
        },
        {
          dataType: "text[]",
          defaultValue: null,
          enumValues: null,
          isArray: true,
          isJson: false,
          isNullable: true,
          name: "content_sections",
          udtName: "_text",
        },
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          content_payload: {
            body: {
              main: "<p>Main</p>",
              sidebar: "Sidebar copy",
            },
          },
          content_sections: ["Intro", "Summary"],
          id: "post-1",
          title: "Nested content",
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = {
      ...createDraft(),
      contentColumns: ["content_payload", "content_payload", "content_sections"],
      contentColumnKinds: ["html", "plain_text", "markdown"] as const,
      contentFieldOptions: [
        {
          arrayItemIndex: "1",
          jsonPath: "body.main",
          relatedColumns: [POSTS_MAPPING_NONE_VALUE],
          relatedTableRef: POSTS_MAPPING_NONE_VALUE,
        },
        {
          arrayItemIndex: "1",
          jsonPath: "body.sidebar",
          relatedColumns: [POSTS_MAPPING_NONE_VALUE],
          relatedTableRef: POSTS_MAPPING_NONE_VALUE,
        },
        {
          arrayItemIndex: "2",
          jsonPath: "",
          relatedColumns: [POSTS_MAPPING_NONE_VALUE],
          relatedTableRef: POSTS_MAPPING_NONE_VALUE,
        },
      ],
    } as PostsMappingDraftState & {
      contentFieldOptions: Array<{
        arrayItemIndex: string;
        jsonPath: string;
        relatedColumns: string[];
        relatedTableRef: string;
      }>;
    };
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(
      config?.entities.posts.editorFields.map((field) => ({
        arrayIndex: (field as { arrayIndex?: number | null }).arrayIndex ?? null,
        column: field.column,
        id: field.id,
        kind: field.kind,
        path: (field as { path?: string | null }).path ?? null,
      })),
    ).toEqual([
      {
        arrayIndex: null,
        column: "content_payload",
        id: "content_payload__body_main",
        kind: "html",
        path: "body.main",
      },
      {
        arrayIndex: null,
        column: "content_payload",
        id: "content_payload__body_sidebar",
        kind: "plain_text",
        path: "body.sidebar",
      },
      {
        arrayIndex: 1,
        column: "content_sections",
        id: "content_sections__item_2",
        kind: "markdown",
        path: null,
      },
    ]);

    const reloadedDraft = support.createPostsMappingDraftFromDetectedMapping(config!.entities.posts) as
      PostsMappingDraftState & {
        contentFieldOptions: Array<{
          arrayItemIndex: string;
          jsonPath: string;
          relatedColumns: string[];
          relatedTableRef: string;
        }>;
      };

    expect(reloadedDraft.contentColumns).toEqual(["content_payload", "content_payload", "content_sections"]);
    expect(reloadedDraft.contentColumnKinds).toEqual(["html", "plain_text", "markdown"]);
    expect(reloadedDraft.contentFieldOptions).toEqual([
      {
        arrayItemIndex: "1",
        jsonPath: "body.main",
        relatedColumns: [POSTS_MAPPING_NONE_VALUE],
        relatedTableRef: POSTS_MAPPING_NONE_VALUE,
      },
      {
        arrayItemIndex: "1",
        jsonPath: "body.sidebar",
        relatedColumns: [POSTS_MAPPING_NONE_VALUE],
        relatedTableRef: POSTS_MAPPING_NONE_VALUE,
      },
      {
        arrayItemIndex: "2",
        jsonPath: "",
        relatedColumns: [POSTS_MAPPING_NONE_VALUE],
        relatedTableRef: POSTS_MAPPING_NONE_VALUE,
      },
    ]);
  });

  it("fills missing saved relation mappings from fresh detection data", () => {
    const mappingDetection = createRelationAwareMappingDetectionPayload();
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const savedPostsMapping = createDefaultContentMappingConfig().entities.posts;

    savedPostsMapping.status = "mapped";
    savedPostsMapping.source = {
      kind: "table",
      primaryKey: "id",
      schema: "public",
      table: "posts",
    };
    savedPostsMapping.fields.id.column = "id";
    savedPostsMapping.fields.title.column = "title";
    savedPostsMapping.editorFields = [
      {
        column: "body_html",
        id: "body_html",
        kind: "html",
        label: "Body",
        placeholder: null,
        required: true,
        visible: true,
      },
    ];

    const draft = support.createPostsMappingDraftFromDetectedMapping(savedPostsMapping);

    expect(draft.author.strategy).toBe("foreign_key");
    expect(draft.author.targetTableRef).toBe("public.authors");
    expect(draft.categories.strategy).toBe("join_table");
    expect(draft.categories.targetTableRef).toBe("public.categories");
    expect(draft.tags.strategy).toBe("join_table");
    expect(draft.tags.targetTableRef).toBe("public.tags");
  });

  it("stores timestamp source hints for generated, trigger-managed, and audit-derived selections", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          name: "body",
          udtName: "text",
        },
        {
          dataType: "timestamp with time zone",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isGenerated: true,
          isJson: false,
          isNullable: false,
          name: "created_at",
          udtName: "timestamptz",
        },
        {
          dataType: "timestamp with time zone",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: false,
          isNullable: true,
          name: "audit_logged_at",
          udtName: "timestamptz",
        },
        {
          dataType: "timestamp with time zone",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: false,
          isNullable: true,
          name: "updated_at",
          udtName: "timestamptz",
        },
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          audit_logged_at: "2026-03-10T00:00:00Z",
          body: "<p>Hello world</p>",
          created_at: "2026-03-09T00:00:00Z",
          id: "post-1",
          title: "Hello world",
          updated_at: "2026-03-11T00:00:00Z",
        },
      ],
      schema: "public",
      triggerDefinitions: [
        "CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at')",
      ],
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = {
      ...createDraft(),
      contentColumns: ["body"],
      contentColumnKinds: ["html"] as PostsMappingDraftState["contentColumnKinds"],
      createdAtColumn: "created_at",
      publishedAtColumn: "audit_logged_at",
      updatedAtColumn: "updated_at",
    };
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(config?.entities.posts.fields.createdAt).toEqual(
      expect.objectContaining({
        column: "created_at",
        timestampSourceHint: "generated",
      }),
    );
    expect(config?.entities.posts.fields.publishedAt).toEqual(
      expect.objectContaining({
        column: "audit_logged_at",
        timestampSourceHint: "audit_derived",
      }),
    );
    expect(config?.entities.posts.fields.updatedAt).toEqual(
      expect.objectContaining({
        column: "updated_at",
        timestampSourceHint: "trigger_managed",
      }),
    );
  });

  it("detects enum-backed status and SEO fields when creating a draft directly from a table", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          name: "body",
          udtName: "text",
        },
        {
          dataType: "USER-DEFINED",
          defaultValue: null,
          enumValues: ["draft", "review", "published"],
          isArray: false,
          isJson: false,
          isNullable: false,
          name: "publication_status",
          udtName: "post_status",
        },
        {
          dataType: "timestamp with time zone",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: false,
          isNullable: true,
          name: "published_at",
          udtName: "timestamptz",
        },
        {
          dataType: "text",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: false,
          isNullable: true,
          name: "meta_title",
          udtName: "text",
        },
        {
          dataType: "text",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: false,
          isNullable: true,
          name: "meta_desc",
          udtName: "text",
        },
        {
          dataType: "text",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: false,
          isNullable: true,
          name: "focus_keyphrase",
          udtName: "text",
        },
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          body: "<p>Hello world</p>",
          focus_keyphrase: "headless cms",
          id: "post-1",
          meta_desc: "A practical guide",
          meta_title: "Mapping Guide",
          publication_status: "published",
          published_at: "2026-03-10T00:00:00Z",
          title: "Mapping Guide",
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);

    const draft = support.createPostsMappingDraftFromTable("public.posts");

    expect(draft?.statusColumn).toBe("publication_status");
    expect(draft?.publishedAtColumn).toBe("published_at");
    expect(draft?.draftValues).toEqual(["draft", "review"]);
    expect(draft?.publishedValues).toEqual(["published"]);
    expect(draft?.seoTitleColumn).toBe("meta_title");
    expect(draft?.seoDescriptionColumn).toBe("meta_desc");
    expect(draft?.focusKeywordColumn).toBe("focus_keyphrase");
  });

  it("detects redirect columns when creating a draft directly from a table", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          name: "body",
          udtName: "text",
        },
        {
          dataType: "text[]",
          defaultValue: null,
          enumValues: null,
          isArray: true,
          isJson: false,
          isNullable: true,
          name: "redirect_paths",
          udtName: "_text",
        },
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          body: "<p>Hello world</p>",
          id: "post-1",
          redirect_paths: ["/old-path", "/older-path"],
          title: "Mapping Guide",
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);

    const draft = support.createPostsMappingDraftFromTable("public.posts");

    expect(draft?.redirectsColumn).toBe("redirect_paths");
  });

  it("persists array-item selections into the saved mapping and loads them back into the draft", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          dataType: "text[]",
          defaultValue: null,
          enumValues: null,
          isArray: true,
          isJson: false,
          isNullable: true,
          name: "title_parts",
          udtName: "_text",
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
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          body_html: "<p>Hello world</p>",
          id: "post-1",
          title_parts: ["ignored", "Visible title"],
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = {
      ...createDraft(),
      contentColumns: ["body_html"],
      contentColumnKinds: ["html"] as PostsMappingDraftState["contentColumnKinds"],
      titleColumn: "title_parts",
      fieldOptions: {
        ...createDraft().fieldOptions,
        titleColumn: {
          arrayItemIndex: "2",
          jsonPath: "",
          relatedColumns: [POSTS_MAPPING_NONE_VALUE],
          relatedTableRef: POSTS_MAPPING_NONE_VALUE,
        },
      },
    };
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(config?.entities.posts.fields.title).toMatchObject({
      arrayIndex: 1,
      column: "title_parts",
    });

    const reloadedDraft = support.createPostsMappingDraftFromDetectedMapping(config!.entities.posts);

    expect(reloadedDraft.titleColumn).toBe("title_parts");
    expect(reloadedDraft.fieldOptions.titleColumn.arrayItemIndex).toBe("2");
  });

  it("persists array-backed redirects as a whole-array mapping", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          name: "body_html",
          udtName: "text",
        },
        {
          dataType: "text[]",
          defaultValue: null,
          enumValues: null,
          isArray: true,
          isJson: false,
          isNullable: true,
          name: "redirect_paths",
          udtName: "_text",
        },
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          body_html: "<p>Hello world</p>",
          id: "post-1",
          redirect_paths: ["/old-path", "/older-path"],
          title: "Mapping Guide",
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = {
      ...createDraft(),
      contentColumns: ["body_html"],
      contentColumnKinds: ["html"] as PostsMappingDraftState["contentColumnKinds"],
      redirectsColumn: "redirect_paths",
      fieldOptions: {
        ...createDraft().fieldOptions,
        redirectsColumn: {
          arrayItemIndex: "2",
          jsonPath: "",
          relatedColumns: [POSTS_MAPPING_NONE_VALUE],
          relatedTableRef: POSTS_MAPPING_NONE_VALUE,
        },
      },
    };
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(config?.entities.posts.fields.redirects).toMatchObject({
      arrayIndex: null,
      column: "redirect_paths",
      kind: "array",
    });

    const reloadedDraft = support.createPostsMappingDraftFromDetectedMapping(config!.entities.posts);

    expect(reloadedDraft.redirectsColumn).toBe("redirect_paths");
    expect(reloadedDraft.fieldOptions.redirectsColumn.arrayItemIndex).toBe("1");
    expect(reloadedDraft.customFields.find((field) => field.column === "redirect_paths")).toBeUndefined();
  });

  it("persists authored non-direct custom field metadata into the saved config and reloads it into the draft", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
          name: "body_html",
          udtName: "text",
        },
        {
          dataType: "jsonb",
          defaultValue: null,
          enumValues: null,
          isArray: false,
          isJson: true,
          isNullable: true,
          name: "metadata",
          udtName: "jsonb",
        },
        {
          dataType: "text[]",
          defaultValue: null,
          enumValues: null,
          isArray: true,
          isJson: false,
          isNullable: true,
          name: "aliases",
          udtName: "_text",
        },
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          aliases: ["primary", "secondary"],
          body_html: "<p>Hello world</p>",
          id: "post-1",
          metadata: { card: { title: "Hello world" } },
          title: "Hello world",
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = {
      ...createDraft(),
      contentColumns: ["body_html"],
      contentColumnKinds: ["html"] as PostsMappingDraftState["contentColumnKinds"],
      customFields: [
        {
          allowedValues: null,
          column: "metadata",
          dataType: "jsonb",
          defaultValue: null,
          enabled: true,
          fieldKey: "card_title",
          isNullable: true,
          kind: "text" as const,
          label: "Card Title",
          path: "card.title",
          sampleValues: [],
        },
        {
          allowedValues: null,
          arrayIndex: 1,
          column: "aliases",
          dataType: "text[]",
          defaultValue: null,
          enabled: true,
          fieldKey: "secondary_alias",
          isNullable: true,
          kind: "text" as const,
          label: "Secondary Alias",
          path: null,
          sampleValues: [],
        },
      ],
    };
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();

    expect(config?.entities.posts.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column: "metadata",
          fieldKey: "card_title",
          kind: "text",
          path: "card.title",
          sourceType: {
            adapterMetadata: {
              postgres: {
                udtName: "jsonb",
              },
            },
            isArray: false,
            isJson: true,
            nativeType: "jsonb",
          },
        }),
        expect.objectContaining({
          arrayIndex: 1,
          column: "aliases",
          fieldKey: "secondary_alias",
          kind: "text",
          sourceType: {
            adapterMetadata: {
              postgres: {
                udtName: "_text",
              },
            },
            isArray: true,
            isJson: false,
            nativeType: "text[]",
          },
        }),
      ]),
    );

    const reloadedDraft = support.createPostsMappingDraftFromDetectedMapping(config!.entities.posts);

    expect(reloadedDraft.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column: "metadata",
          fieldKey: "card_title",
          kind: "text",
          path: "card.title",
        }),
        expect.objectContaining({
          arrayIndex: 1,
          column: "aliases",
          fieldKey: "secondary_alias",
          kind: "text",
        }),
      ]),
    );

    expect(support.getCustomFieldsForTable(postsTable, reloadedDraft)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column: "metadata",
          fieldKey: "card_title",
          kind: "text",
          path: "card.title",
        }),
        expect.objectContaining({
          arrayIndex: 1,
          column: "aliases",
          fieldKey: "secondary_alias",
          kind: "text",
        }),
      ]),
    );
  });

  it("preserves saved relation-backed custom scalar fields through draft reload and config rebuild", () => {
    const mappingDetection = createMappingDetectionPayloadForTable({
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
      ],
      foreignKeys: [],
      kind: "table",
      name: "posts",
      primaryKey: "id",
      rowCountEstimate: 4,
      sampleRows: [
        {
          id: "post-1",
          title: "Hello world",
        },
      ],
      schema: "public",
    });
    const support = createProjectEditorPostsMappingSupport(mappingDetection);
    const draft = {
      ...createDraft(),
      customFields: [
        {
          allowedValues: null,
          column: "subtitle_lookup_id",
          dataType: "uuid",
          defaultValue: null,
          enabled: true,
          fieldKey: "subtitle_text",
          isNullable: true,
          kind: "text" as const,
          label: "Subtitle",
          sampleValues: [],
          sourceRelation: {
            junctionSourceColumn: null,
            junctionTable: null,
            sourceColumn: "subtitle_lookup_id",
            strategy: "foreign_key" as const,
            targetColumn: "id",
            targetTable: "public.post_subtitle_rows",
            valueColumn: "subtitle_text",
          },
        },
        {
          allowedValues: null,
          column: "helper_subtitle",
          dataType: "text",
          defaultValue: null,
          enabled: true,
          fieldKey: "helper_subtitle",
          isNullable: true,
          kind: "text" as const,
          label: "Helper Subtitle",
          sampleValues: [],
          sourceRelation: {
            junctionSourceColumn: "post_id",
            junctionTable: "public.post_subtitle_helper",
            sourceColumn: null,
            strategy: "related_row_by_post_id" as const,
            targetColumn: null,
            targetTable: null,
            valueColumn: "subtitle_text",
          },
        },
      ],
    };
    const postsTable = mappingDetection.tables[0];
    const defaultMappingConfig = createDefaultContentMappingConfig();
    const { buildPostsMappingConfig } = createProjectEditorPostsMappingConfigBuilder({
      baseMappingConfig: defaultMappingConfig,
      defaultMappingConfig,
      detectContentKindForColumn: support.detectContentKindForColumn,
      getBooleanStatusValueLists: support.getBooleanStatusValueLists,
      getCustomFieldsForTable: support.getCustomFieldsForTable,
      getRelationDraftKeyForEntity: support.getRelationDraftKeyForEntity,
      getRelationTargetTableRef: (_key, relation) => relation.targetTableRef,
      getTableByRef: support.getTableByRef,
      getTableColumn: support.getTableColumn,
      isBooleanLikeColumn: support.isBooleanLikeColumn,
      mappingEntryCollection: "Posts",
      postsMappingDraft: draft,
      postsTable,
      relationEntityByKey: support.relationEntityByKey,
    });

    const config = buildPostsMappingConfig();
    const reloadedDraft = support.createPostsMappingDraftFromDetectedMapping(config!.entities.posts);

    expect(config?.entities.posts.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "subtitle_text",
          sourceRelation: expect.objectContaining({
            strategy: "foreign_key",
            sourceColumn: "subtitle_lookup_id",
          }),
        }),
        expect.objectContaining({
          fieldKey: "helper_subtitle",
          sourceRelation: expect.objectContaining({
            strategy: "related_row_by_post_id",
            junctionTable: "public.post_subtitle_helper",
          }),
        }),
      ]),
    );

    expect(reloadedDraft.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "subtitle_text",
          sourceRelation: expect.objectContaining({
            strategy: "foreign_key",
            sourceColumn: "subtitle_lookup_id",
          }),
        }),
        expect.objectContaining({
          fieldKey: "helper_subtitle",
          sourceRelation: expect.objectContaining({
            strategy: "related_row_by_post_id",
            junctionTable: "public.post_subtitle_helper",
          }),
        }),
      ]),
    );
  });
});
