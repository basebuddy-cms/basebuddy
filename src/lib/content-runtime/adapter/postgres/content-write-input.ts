import type { ContentProjectMapping } from "@/lib/content-runtime/mapping";
import {
  normalizeContentRuntimeContent,
  normalizeContentRuntimePostContentFieldValue,
} from "@/lib/content-runtime/content-conversion";

import type { ContentCompiledAdapterMapping } from "../compiler";
import type { ContentAdapterSavePostRequest } from "../contracts";
import { createContentAdapterValidationError } from "../error-mapping";
import { isWritableEditabilityState } from "./write-value-coercion";

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const sanitizeAdapterContentWriteInput = ({
  compiled,
  mapping,
  request,
}: {
  compiled: ContentCompiledAdapterMapping;
  mapping: ContentProjectMapping;
  request: ContentAdapterSavePostRequest;
}) => {
  const writableStructuredFields = Object.values(compiled.structuredFields).filter((fieldInstruction) =>
    isWritableEditabilityState(fieldInstruction.editabilityState),
  );

  if (!writableStructuredFields.length) {
    return {
      contentFields: undefined,
      contentHtml: undefined,
      contentJson: undefined,
      contentMarkdown: undefined,
    };
  }

  const posts = mapping.mappingConfig.entities.posts;
  const writableEditorFields = posts.editorFields.filter(
    (editorField) =>
      editorField.visible &&
      (editorField.column || editorField.sourceRelation) &&
      writableStructuredFields.some((fieldInstruction) => fieldInstruction.fieldKey === editorField.id),
  );
  const primaryEditorField = writableEditorFields[0] ?? null;
  const primaryContentFormat = primaryEditorField?.kind === "markdown" ? "markdown" : "html";
  const hasPrimaryContentInput =
    request.contentHtml !== undefined || request.contentJson !== undefined || request.contentMarkdown !== undefined;
  const rawContentFields = request.contentFields;

  let normalizedContentFields: ContentAdapterSavePostRequest["contentFields"];
  if (rawContentFields !== undefined) {
    if (!isObjectRecord(rawContentFields)) {
      throw createContentAdapterValidationError({
        code: "invalid_json_object",
        fieldKey: "content",
        message: 'Invalid value for "Content". Content fields must be an object.',
      });
    }

    const nextEntries = writableEditorFields.flatMap((editorField) => {
      const rawValue = rawContentFields[editorField.id];

      if (rawValue === undefined) {
        return [];
      }

      if (!isObjectRecord(rawValue)) {
        throw createContentAdapterValidationError({
          code: "invalid_json_object",
          fieldKey: "content",
          message: `Invalid value for "Content". Field "${editorField.label}" must be an object.`,
          metadata: {
            editorFieldId: editorField.id,
          },
        });
      }

      return [
        [
          editorField.id,
          normalizeContentRuntimePostContentFieldValue({
            contentHtml: rawValue.contentHtml === undefined ? null : String(rawValue.contentHtml ?? ""),
            contentJson:
              rawValue.contentJson === undefined
                ? null
                : (() => {
                    if (!isObjectRecord(rawValue.contentJson)) {
                      throw createContentAdapterValidationError({
                        code: "invalid_json_object",
                        fieldKey: "content",
                        message: 'Invalid value for "Content". Value must be a JSON object.',
                        metadata: {
                          editorFieldId: editorField.id,
                          path: `${editorField.id}.contentJson`,
                        },
                      });
                    }

                    return rawValue.contentJson;
                  })(),
          }),
        ] as const,
      ];
    });

    normalizedContentFields = nextEntries.length ? Object.fromEntries(nextEntries) : undefined;
  }

  let normalizedPrimaryContent: ReturnType<typeof normalizeContentRuntimeContent> | null = null;

  if (hasPrimaryContentInput) {
    normalizedPrimaryContent = normalizeContentRuntimeContent({
      contentHtml: request.contentHtml === undefined ? null : String(request.contentHtml ?? ""),
      contentJson:
        request.contentJson === undefined || request.contentJson === null
          ? null
          : (() => {
              if (!isObjectRecord(request.contentJson)) {
                throw createContentAdapterValidationError({
                  code: "invalid_json_object",
                  fieldKey: "content",
                  message: 'Invalid value for "Content". Value must be a JSON object.',
                  metadata: {
                    path: "contentJson",
                  },
                });
              }

              return request.contentJson;
            })(),
      contentMarkdown: request.contentMarkdown === undefined ? null : String(request.contentMarkdown ?? ""),
      primaryContentFormat,
    });
  } else if (primaryEditorField && normalizedContentFields?.[primaryEditorField.id]) {
    normalizedPrimaryContent = normalizeContentRuntimeContent({
      contentHtml: normalizedContentFields[primaryEditorField.id]?.contentHtml ?? null,
      contentJson: normalizedContentFields[primaryEditorField.id]?.contentJson ?? null,
      primaryContentFormat,
    });
  }

  return {
    contentFields: normalizedContentFields,
    contentHtml: normalizedPrimaryContent?.contentHtml,
    contentJson: normalizedPrimaryContent?.contentJson,
    contentMarkdown: normalizedPrimaryContent?.contentMarkdown,
  };
};
