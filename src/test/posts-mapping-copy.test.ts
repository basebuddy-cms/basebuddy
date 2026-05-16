import { describe, expect, it } from "vitest";

import {
  POSTS_MAPPING_NONE_VALUE,
  POSTS_MAPPING_NOT_IN_TABLE_VALUE,
} from "@/components/editor/project-editor/constants";
import {
  buildProjectEditorSpecialSelectOptions,
} from "@/components/editor/project-editor/posts-mapping-config";
import {
  getProjectEditorPostsMappingFieldHelperText,
} from "@/components/editor/project-editor/posts-mapping-ui";
import type { ContentIntrospectedTable } from "@/lib/content-runtime/introspection";
import type { PostsMappingDraftState } from "@/components/editor/project-editor/types";

const postsTable: ContentIntrospectedTable = {
  columns: [
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
  rowCountEstimate: 1,
  sampleRows: [],
  schema: "public",
};

const fieldOptions = {
  arrayItemIndex: "1",
  jsonPath: "",
  relatedColumns: [POSTS_MAPPING_NONE_VALUE],
  relatedTableRef: POSTS_MAPPING_NONE_VALUE,
};

const postsMappingDraft = {
  fieldOptions: {
    redirectsColumn: fieldOptions,
  },
} as PostsMappingDraftState;

describe("posts mapping copy", () => {
  it("labels related-table storage as stored in another table", () => {
    expect(buildProjectEditorSpecialSelectOptions("featured image")[0]).toEqual({
      label: "Stored in another table",
      value: POSTS_MAPPING_NOT_IN_TABLE_VALUE,
    });
  });

  it("uses related-table helper copy for fields stored away from the posts table", () => {
    expect(
      getProjectEditorPostsMappingFieldHelperText({
        buildMissingOptionLabel: (label) => `Skip ${label.toLowerCase()}`,
        getColumnForeignKey: () => null,
        getTableColumn: () => null,
        isBooleanLikeColumn: () => false,
        key: "featuredImageUrlColumn",
        label: "Featured Image",
        postsMappingDraft: null,
        postsTable,
        value: POSTS_MAPPING_NOT_IN_TABLE_VALUE,
      }),
    ).toBe("Featured Image is stored in another table.");
  });

  it("says redirects use every array item instead of one selected item", () => {
    expect(
      getProjectEditorPostsMappingFieldHelperText({
        buildMissingOptionLabel: (label) => `Skip ${label.toLowerCase()}`,
        getColumnForeignKey: () => null,
        getTableColumn: (table, columnName) =>
          table.columns.find((column) => column.name === columnName) ?? null,
        isBooleanLikeColumn: () => false,
        key: "redirectsColumn",
        label: "Redirects",
        postsMappingDraft,
        postsTable,
        value: "redirect_paths",
      }),
    ).toBe("Stored as an array on posts.redirect_paths. BaseBuddy will use every item as a redirect path.");
  });
});
