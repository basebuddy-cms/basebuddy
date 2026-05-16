import { describe, expect, it } from "vitest";

import {
  getNextSelectedTaxonomyIds,
  getNextTaxonomyDraftNameChange,
  getTaxonomySlugInputValue,
} from "@/components/editor/project-editor/taxonomy-selection";

describe("project editor taxonomy selection helpers", () => {
  it("toggles individual and bulk taxonomy selections without duplicates", () => {
    expect(
      getNextSelectedTaxonomyIds({
        checked: true,
        currentIds: ["cat-1"],
        entryId: "cat-1",
      }),
    ).toEqual(["cat-1"]);
    expect(
      getNextSelectedTaxonomyIds({
        checked: true,
        currentIds: ["cat-1"],
        entryId: "cat-2",
      }),
    ).toEqual(["cat-1", "cat-2"]);
    expect(
      getNextSelectedTaxonomyIds({
        checked: false,
        currentIds: ["cat-1", "cat-2"],
        entryId: "cat-1",
      }),
    ).toEqual(["cat-2"]);
  });

  it("mirrors taxonomy slug only while the slug still matches the previous automatic slug", () => {
    expect(
      getNextTaxonomyDraftNameChange({
        currentName: "Old Name",
        currentSlug: "old-name",
        nextName: "New Name",
      }),
    ).toEqual({
      nextName: "New Name",
      nextSlug: "new-name",
    });
    expect(
      getNextTaxonomyDraftNameChange({
        currentName: "Old Name",
        currentSlug: "custom",
        nextName: "New Name",
      }),
    ).toEqual({
      nextName: "New Name",
      nextSlug: null,
    });
    expect(getTaxonomySlugInputValue("Hello World!")).toBe("hello-world");
  });
});
