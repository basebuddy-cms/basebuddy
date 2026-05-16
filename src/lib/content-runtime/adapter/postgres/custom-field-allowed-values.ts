import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";

export const resolveCustomFieldAllowedValues = (
  customField:
    | ContentProjectMapping["mappingConfig"]["entities"]["posts"]["customFields"][number]
    | undefined,
) =>
  customField?.allowedValues?.length
    ? customField.allowedValues
    : customField?.kind === "enum" && customField.sampleValues.length
      ? customField.sampleValues
      : null;
