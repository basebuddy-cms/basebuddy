import type { ContentPost } from "@/lib/content-runtime/shared";
import type {
  ProjectEditorPostFieldStates,
  YoastResult,
} from "@/components/editor/project-editor/types";

export type ProjectEditorSeoCapabilities = {
  canEditExcerpt: boolean;
  canEditFocusKeyword: boolean;
  canEditSeoDescription: boolean;
  canEditSeoTitle: boolean;
  canEditSlug: boolean;
  canEditTitle: boolean;
  hasWebsiteUrl: boolean;
};

export const getProjectEditorSeoCapabilities = ({
  hasWebsiteUrl,
  postFieldStates,
}: {
  hasWebsiteUrl: boolean;
  postFieldStates: ProjectEditorPostFieldStates;
}): ProjectEditorSeoCapabilities => ({
  canEditExcerpt: postFieldStates.excerpt.editable,
  canEditFocusKeyword: postFieldStates.focusKeyword.editable || !postFieldStates.focusKeyword.mapped,
  canEditSeoDescription: postFieldStates.seoDescription.editable,
  canEditSeoTitle: postFieldStates.seoTitle.editable,
  canEditSlug: postFieldStates.slug.editable,
  canEditTitle: postFieldStates.title.editable,
  hasWebsiteUrl,
});

export const isProjectEditorYoastSeoResultActionable = ({
  capabilities,
  resultId,
}: {
  capabilities: ProjectEditorSeoCapabilities;
  resultId: string;
}) => {
  switch (resultId) {
    case "externalLinks":
    case "internalLinks":
      return capabilities.hasWebsiteUrl;
    case "keyphraseInSEOTitle":
    case "titleWidth":
      return capabilities.canEditSeoTitle || capabilities.canEditTitle;
    case "metaDescriptionKeyword":
    case "metaDescriptionLength":
      return capabilities.canEditSeoDescription || capabilities.canEditExcerpt;
    case "slugKeyword":
    case "urlKeyword":
      return capabilities.canEditSlug;
    default:
      return true;
  }
};

export const filterProjectEditorYoastSeoResults = ({
  capabilities,
  results,
}: {
  capabilities: ProjectEditorSeoCapabilities;
  results: YoastResult[];
}) => results.filter((result) => isProjectEditorYoastSeoResultActionable({ capabilities, resultId: result.id }));

export const mergePostWithLocalFocusKeyword = ({
  focusKeyword,
  post,
}: {
  focusKeyword: string | null;
  post: ContentPost;
}) => {
  if (post.focusKeyword?.trim()) {
    return post;
  }

  if (!focusKeyword) {
    return post;
  }

  return {
    ...post,
    focusKeyword,
  };
};
