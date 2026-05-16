import { slugifyContentValue } from "@/lib/content-runtime/shared";

export const getNextSelectedTaxonomyIds = ({
  checked,
  currentIds,
  entryId,
}: {
  checked: boolean;
  currentIds: string[];
  entryId: string;
}) =>
  checked
    ? Array.from(new Set([...currentIds, entryId]))
    : currentIds.filter((value) => value !== entryId);

export const getTaxonomySlugInputValue = (value: string) => slugifyContentValue(value);

export const getNextTaxonomyDraftNameChange = ({
  currentName,
  currentSlug,
  nextName,
}: {
  currentName: string;
  currentSlug: string;
  nextName: string;
}) => {
  const currentAutoSlug = slugifyContentValue(currentName) || "untitled";
  const shouldMirrorSlug = !currentSlug || currentSlug === currentAutoSlug;

  return {
    nextName,
    nextSlug: shouldMirrorSlug ? slugifyContentValue(nextName) : null,
  };
};
