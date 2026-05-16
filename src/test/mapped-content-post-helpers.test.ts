import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCustomFieldDefaultValue } from "@/lib/content-runtime/mapped-content-custom-field-defaults";
import {
  dedupeMappedContentRelationValues,
  isMappedContentHelperRowRelation,
  isMappedContentJoinTableRelation,
  resolveMappedContentAvailableColumn,
} from "@/lib/content-runtime/mapped-content-post-relation-utils";

describe("existing db runtime post helper modules", () => {
  it("normalizes relation values and relation strategy groups", () => {
    expect(dedupeMappedContentRelationValues([" a ", "a", "", null, "b"])).toEqual(["a", "b"]);
    expect(resolveMappedContentAvailableColumn(new Map([["title", "Title"]]), " TITLE ")).toBe("Title");
    expect(isMappedContentHelperRowRelation({ strategy: "join_row" } as never)).toBe(true);
    expect(isMappedContentJoinTableRelation({ strategy: "polymorphic_join" } as never)).toBe(true);
  });

  it("returns storage-shaped defaults for custom field mappings", () => {
    expect(getCustomFieldDefaultValue({ kind: "boolean" } as never)).toBe(false);
    expect(getCustomFieldDefaultValue({ kind: "number" } as never)).toBe(0);
    expect(getCustomFieldDefaultValue({ column: "setting", dataType: "jsonb", kind: "json" } as never)).toBe("{}");
    expect(getCustomFieldDefaultValue({ column: "items", dataType: "jsonb", kind: "json" } as never)).toBe("[]");
  });
});
