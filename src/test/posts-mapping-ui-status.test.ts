import { describe, expect, it } from "vitest";

import { getPostsMappingStatusSelectableValues } from "@/components/editor/project-editor/posts-mapping-ui";
import type {
  ContentIntrospectedColumn,
  ContentIntrospectedTable,
} from "@/lib/content-runtime/introspection";

const createStatusColumn = (
  overrides: Partial<ContentIntrospectedColumn> = {},
): ContentIntrospectedColumn => ({
  dataType: "text",
  defaultValue: null,
  enumValues: null,
  isArray: false,
  isJson: false,
  isNullable: false,
  name: "status",
  udtName: "text",
  ...overrides,
});

const postsTable: ContentIntrospectedTable = {
  columns: [],
  foreignKeys: [],
  kind: "table",
  name: "posts",
  primaryKey: "id",
  rowCountEstimate: 1,
  sampleRows: [],
  schema: "public",
};

describe("posts mapping status options", () => {
  it("prefers enum values over sample values for workflow selects", () => {
    const result = getPostsMappingStatusSelectableValues({
      currentValues: [],
      getNormalizedSampleValues: () => ["draft", "published", "archived", "unexpected"],
      postsTable,
      selectedColumn: createStatusColumn({
        dataType: "USER-DEFINED",
        enumValues: ["draft", "review", "published"],
        udtName: "post_status",
      }),
      value: "publication_status",
    });

    expect(result).toEqual(["draft", "review", "published"]);
  });

  it("falls back to sample values when no enum values are available", () => {
    const result = getPostsMappingStatusSelectableValues({
      currentValues: [],
      getNormalizedSampleValues: () => ["draft", "published"],
      postsTable,
      selectedColumn: createStatusColumn(),
      value: "status",
    });

    expect(result).toEqual(["draft", "published"]);
  });

  it("keeps current mapped values visible even when they are not in the enum list", () => {
    const result = getPostsMappingStatusSelectableValues({
      currentValues: ["legacy_status"],
      getNormalizedSampleValues: () => ["draft", "published"],
      postsTable,
      selectedColumn: createStatusColumn({
        dataType: "USER-DEFINED",
        enumValues: ["draft", "published"],
        udtName: "post_status",
      }),
      value: "publication_status",
    });

    expect(result).toEqual(["legacy_status", "draft", "published"]);
  });
});
