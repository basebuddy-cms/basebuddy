import { generateHTML, generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import MarkdownIt from "markdown-it";
import TurndownService from "turndown";

import {
  createDefaultEditorDoc,
  getContentPrimaryEditorFieldId,
  type ContentEditorFieldSummary,
  type ContentPost,
  type ContentPostContentFieldValue,
  type ContentPrimaryContentFormat,
} from "./shared";
import { createContentRuntimeEditorExtensions } from "./editor-extensions";

const EMPTY_HTML = "<p></p>";
const EMPTY_MARKDOWN = "";
const XHTML_NAMESPACE_ATTRIBUTE = /\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g;

const markdownRenderer = new MarkdownIt({
  breaks: false,
  html: false,
  linkify: true,
});

const turndownService = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

export type ContentRuntimeNormalizedContent = {
  contentHtml: string;
  contentJson: Record<string, unknown>;
  contentMarkdown: string;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeHtml = (html: string | null | undefined) => {
  const trimmedHtml = (html?.trim() ?? "").replace(XHTML_NAMESPACE_ATTRIBUTE, "");
  return trimmedHtml ? trimmedHtml : EMPTY_HTML;
};

const normalizeMarkdown = (markdown: string | null | undefined) => markdown?.trim() ?? EMPTY_MARKDOWN;

const createCanonicalContentJson = (
  contentJson: Record<string, unknown> | JSONContent | null | undefined,
) => {
  if (!isObjectRecord(contentJson)) {
    return createDefaultEditorDoc();
  }

  try {
    return generateJSON(
      normalizeHtml(generateHTML(contentJson as JSONContent, createContentRuntimeEditorExtensions())),
      createContentRuntimeEditorExtensions(),
    ) as Record<string, unknown>;
  } catch {
    return createDefaultEditorDoc();
  }
};

export const contentRuntimeJsonToHtml = (contentJson: Record<string, unknown> | JSONContent | null | undefined) => {
  if (!isObjectRecord(contentJson)) {
    return EMPTY_HTML;
  }

  try {
    const html = generateHTML(contentJson as JSONContent, createContentRuntimeEditorExtensions());
    return normalizeHtml(html);
  } catch {
    return EMPTY_HTML;
  }
};

export const contentRuntimeHtmlToJson = (contentHtml: string | null | undefined) => {
  const normalizedHtml = normalizeHtml(contentHtml);

  try {
    return generateJSON(normalizedHtml, createContentRuntimeEditorExtensions()) as Record<string, unknown>;
  } catch {
    return createDefaultEditorDoc();
  }
};

export const sanitizeContentRuntimeHtml = (contentHtml: string | null | undefined) =>
  contentRuntimeJsonToHtml(contentRuntimeHtmlToJson(contentHtml));

export const contentRuntimeMarkdownToHtml = (contentMarkdown: string | null | undefined) => {
  const normalizedMarkdown = normalizeMarkdown(contentMarkdown);

  if (!normalizedMarkdown) {
    return EMPTY_HTML;
  }

  try {
    return sanitizeContentRuntimeHtml(markdownRenderer.render(normalizedMarkdown));
  } catch {
    return EMPTY_HTML;
  }
};

export const contentRuntimeHtmlToMarkdown = (contentHtml: string | null | undefined) => {
  const normalizedHtml = normalizeHtml(contentHtml);

  if (normalizedHtml === EMPTY_HTML) {
    return EMPTY_MARKDOWN;
  }

  try {
    return normalizeMarkdown(turndownService.turndown(normalizedHtml));
  } catch {
    return EMPTY_MARKDOWN;
  }
};

export const contentRuntimeMarkdownToJson = (contentMarkdown: string | null | undefined) =>
  contentRuntimeHtmlToJson(contentRuntimeMarkdownToHtml(contentMarkdown));

export const contentRuntimeJsonToMarkdown = (contentJson: Record<string, unknown> | JSONContent | null | undefined) =>
  contentRuntimeHtmlToMarkdown(contentRuntimeJsonToHtml(contentJson));

export const createEmptyContentRuntimeContent = (): ContentRuntimeNormalizedContent => ({
  contentHtml: EMPTY_HTML,
  contentJson: createDefaultEditorDoc(),
  contentMarkdown: EMPTY_MARKDOWN,
});

export const normalizeContentRuntimePostContentFieldValue = (
  value: Partial<ContentPostContentFieldValue> | null | undefined,
): ContentPostContentFieldValue => {
  const normalized = normalizeContentRuntimeContent({
    contentHtml: typeof value?.contentHtml === "string" ? value.contentHtml : null,
    contentJson: isObjectRecord(value?.contentJson) ? value.contentJson : null,
    primaryContentFormat: "html",
  });

  return {
    contentHtml: normalized.contentHtml,
    contentJson: normalized.contentJson,
  };
};

export const normalizeContentRuntimePostForEditor = ({
  editorFields,
  post,
}: {
  editorFields?: Array<Pick<ContentEditorFieldSummary, "id">> | null;
  post: ContentPost;
}): ContentPost => {
  const primaryContentFormat: ContentPrimaryContentFormat =
    post.contentFormat === "markdown" ? "markdown" : "html";
  const normalizedPrimaryContent = normalizeContentRuntimeContent({
    contentHtml: typeof post.contentHtml === "string" ? post.contentHtml : null,
    contentJson: isObjectRecord(post.contentJson) ? post.contentJson : null,
    contentMarkdown: typeof post.contentMarkdown === "string" ? post.contentMarkdown : null,
    primaryContentFormat,
  });
  const rawContentFields = isObjectRecord((post as { contentFields?: unknown }).contentFields)
    ? (((post as { contentFields?: unknown }).contentFields as Record<string, unknown>) ?? {})
    : {};
  const normalizedContentFields = Object.fromEntries(
    Object.entries(rawContentFields).map(([fieldId, value]) => [
      fieldId,
      normalizeContentRuntimePostContentFieldValue(
        isObjectRecord(value) ? (value as Partial<ContentPostContentFieldValue>) : null,
      ),
    ]),
  ) as Record<string, ContentPostContentFieldValue>;
  const primaryFieldId = getContentPrimaryEditorFieldId(editorFields);

  if (primaryFieldId && !normalizedContentFields[primaryFieldId]) {
    normalizedContentFields[primaryFieldId] = {
      contentHtml: normalizedPrimaryContent.contentHtml,
      contentJson: normalizedPrimaryContent.contentJson,
    };
  }

  return {
    ...post,
    contentFields: normalizedContentFields,
    contentFormat: primaryContentFormat,
    contentHtml: normalizedPrimaryContent.contentHtml,
    contentJson: normalizedPrimaryContent.contentJson,
    contentMarkdown: normalizedPrimaryContent.contentMarkdown,
  };
};

export const normalizeContentRuntimeContent = ({
  contentHtml,
  contentJson,
  contentMarkdown,
  primaryContentFormat,
}: {
  contentHtml?: string | null;
  contentJson?: Record<string, unknown> | null;
  contentMarkdown?: string | null;
  primaryContentFormat: ContentPrimaryContentFormat;
}): ContentRuntimeNormalizedContent => {
  if (isObjectRecord(contentJson)) {
    const canonicalContentJson = createCanonicalContentJson(contentJson);

    return {
      contentHtml: contentRuntimeJsonToHtml(canonicalContentJson),
      contentJson: canonicalContentJson,
      contentMarkdown: contentRuntimeJsonToMarkdown(canonicalContentJson),
    };
  }

  if (primaryContentFormat === "markdown") {
    const rawMarkdown =
      typeof contentMarkdown === "string"
        ? normalizeMarkdown(contentMarkdown)
        : contentRuntimeHtmlToMarkdown(contentHtml);
    const nextHtml = contentRuntimeMarkdownToHtml(rawMarkdown);
    const nextContentJson = contentRuntimeHtmlToJson(nextHtml);

    return {
      contentHtml: nextHtml,
      contentJson: nextContentJson,
      contentMarkdown: contentRuntimeHtmlToMarkdown(nextHtml),
    };
  }

  const nextHtml = sanitizeContentRuntimeHtml(contentHtml);
  const nextContentJson = contentRuntimeHtmlToJson(nextHtml);

  return {
    contentHtml: nextHtml,
    contentJson: nextContentJson,
    contentMarkdown: contentRuntimeHtmlToMarkdown(nextHtml),
  };
};
