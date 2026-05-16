import { createDefaultEditorDoc } from "@/lib/content-runtime/shared";

const isEditorDocumentRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const getResolvedPostEditorContentJson = (contentJson: unknown): Record<string, unknown> =>
  isEditorDocumentRecord(contentJson) ? contentJson : createDefaultEditorDoc();
