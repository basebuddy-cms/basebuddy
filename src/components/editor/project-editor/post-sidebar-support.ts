import type {
  ContentRuntimeSummary,
  ContentPostSidebarConfig,
  ContentPostSidebarFieldKey,
  ContentPostSidebarNode,
  ContentPostSidebarPageNode,
} from "@/lib/content-runtime/shared";
import {
  createDefaultContentPostSidebarConfig,
  normalizeContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";

import type { PostSidePanelView } from "./types";

const SYSTEM_PAGE_DEFINITIONS = {
  "custom-fields": {
    id: "custom-fields",
    label: "Custom Fields",
  },
  "meta-fields": {
    id: "meta-fields",
    label: "Meta Fields",
  },
  "seo-fields": {
    id: "seo-fields",
    label: "SEO Fields",
  },
} as const;

export type ProjectEditorPostSidebarFieldDefinition = {
  defaultParentId: string | null;
  description: string;
  id: ContentPostSidebarFieldKey;
  label: string;
};

export type ProjectEditorResolvedPostSidebarNode =
  | {
      id: string;
      kind: "page";
      label: string;
      parentId: string | null;
      visible: boolean;
    }
  | {
      description: string;
      id: ContentPostSidebarFieldKey;
      kind: "field";
      label: string;
      parentId: string | null;
      visible: boolean;
    };

const getSystemPageDefinition = (pageId: string) =>
  pageId in SYSTEM_PAGE_DEFINITIONS
    ? SYSTEM_PAGE_DEFINITIONS[pageId as keyof typeof SYSTEM_PAGE_DEFINITIONS]
    : null;

const DEFAULT_SIDEBAR_FIELD_DEFINITIONS: ProjectEditorPostSidebarFieldDefinition[] = [
  {
    defaultParentId: null,
    description: "Choose the author assigned to this post.",
    id: "author",
    label: "Author",
  },
  {
    defaultParentId: null,
    description: "Adjust the published date and time for this post.",
    id: "published_at",
    label: "Published On",
  },
  {
    defaultParentId: null,
    description: "Adjust the updated date and time for this post.",
    id: "updated_at",
    label: "Updated On",
  },
  {
    defaultParentId: null,
    description: "Edit the short summary used in previews and listings.",
    id: "excerpt",
    label: "Excerpt",
  },
  {
    defaultParentId: null,
    description: "Edit the URL slug for this post.",
    id: "slug",
    label: "URL Slug",
  },
  {
    defaultParentId: null,
    description: "Upload or replace the featured image.",
    id: "featured_image",
    label: "Featured Image",
  },
  {
    defaultParentId: null,
    description: "Select one or more categories for this post.",
    id: "categories",
    label: "Categories",
  },
  {
    defaultParentId: null,
    description: "Select one or more tags for this post.",
    id: "tags",
    label: "Tags",
  },
  {
    defaultParentId: "seo-fields",
    description: "Choose the main keyword this post should target.",
    id: "focus_keyword",
    label: "Focus Keyword",
  },
  {
    defaultParentId: "meta-fields",
    description: "Override the meta title used in search results.",
    id: "meta_title",
    label: "Meta Title",
  },
  {
    defaultParentId: "meta-fields",
    description: "Override the meta description used in search results.",
    id: "meta_description",
    label: "Meta Description",
  },
];

const getAdapterSidebarFieldDefinitions = (
  contentRuntime: ContentRuntimeSummary | null,
) =>
  (contentRuntime?.sidebarFieldSpecs ?? [])
    .filter((fieldSpec) => fieldSpec.visible)
    .map((fieldSpec) => ({
      defaultParentId: fieldSpec.defaultParentId,
      description: fieldSpec.description,
      id: fieldSpec.sidebarFieldId,
      label: fieldSpec.label,
    }));

const hasVisibleMappedContentSeoField = (
  contentRuntime: ContentRuntimeSummary | null,
) =>
  contentRuntime?.fieldSpecs?.some(
    (fieldSpec) =>
      fieldSpec.visible &&
      (fieldSpec.semanticRole === "focusKeyword" ||
        fieldSpec.semanticRole === "seoTitle" ||
        fieldSpec.semanticRole === "seoDescription"),
  ) ||
  contentRuntime?.sidebarFieldSpecs?.some(
    (fieldSpec) =>
      fieldSpec.visible &&
      (fieldSpec.semanticRole === "focusKeyword" ||
        fieldSpec.semanticRole === "seoTitle" ||
        fieldSpec.semanticRole === "seoDescription"),
  ) ||
  false;

export const getProjectEditorPostSidebarFieldDefinitions = ({
  contentRuntime,
}: {
  contentRuntime: ContentRuntimeSummary | null;
  supportsPostRevisions: boolean;
}) => {
  const fieldDefinitions: ProjectEditorPostSidebarFieldDefinition[] = contentRuntime
    ? [...getAdapterSidebarFieldDefinitions(contentRuntime)]
    : [...DEFAULT_SIDEBAR_FIELD_DEFINITIONS];
  const fieldIds = new Set(fieldDefinitions.map((fieldDefinition) => fieldDefinition.id));
  const pushFieldDefinition = (fieldDefinition: ProjectEditorPostSidebarFieldDefinition) => {
    if (fieldIds.has(fieldDefinition.id)) {
      return;
    }

    fieldDefinitions.push(fieldDefinition);
    fieldIds.add(fieldDefinition.id);
  };

  pushFieldDefinition({
    defaultParentId: null,
    description: "Open the current post preview.",
    id: "preview",
    label: "Preview",
  });

  if (contentRuntime === null || hasVisibleMappedContentSeoField(contentRuntime)) {
    pushFieldDefinition({
      defaultParentId: "seo-fields",
      description: "Review actionable SEO checks for this post.",
      id: "seo_analysis",
      label: "SEO Analysis",
    });
    pushFieldDefinition({
      defaultParentId: "seo-fields",
      description: "Review readability checks for the current content.",
      id: "readability_analysis",
      label: "Readability Analysis",
    });
  }

  return fieldDefinitions;
};

const getRequiredSystemPageIds = (fieldDefinitions: ProjectEditorPostSidebarFieldDefinition[]) =>
  Array.from(
    new Set(
      fieldDefinitions
        .map((fieldDefinition) => fieldDefinition.defaultParentId)
        .filter((pageId): pageId is string => Boolean(pageId && getSystemPageDefinition(pageId))),
    ),
  );

export const createProjectEditorDefaultPostSidebarConfig = ({
  contentRuntime,
  supportsPostRevisions,
}: {
  contentRuntime: ContentRuntimeSummary | null;
  supportsPostRevisions: boolean;
}): ContentPostSidebarConfig => {
  const defaultConfig = createDefaultContentPostSidebarConfig();
  const fieldDefinitions = getProjectEditorPostSidebarFieldDefinitions({
    contentRuntime,
    supportsPostRevisions,
  });
  const fieldDefinitionIds = new Set(fieldDefinitions.map((fieldDefinition) => fieldDefinition.id));
  const requiredSystemPageIds = new Set(getRequiredSystemPageIds(fieldDefinitions));

  return {
    nodes: [
      ...defaultConfig.nodes.filter((node) =>
        node.kind === "page"
          ? requiredSystemPageIds.has(node.id)
          : fieldDefinitionIds.has(node.id),
      ),
      ...fieldDefinitions
        .filter(
          (fieldDefinition) =>
            !defaultConfig.nodes.some((node) => node.kind === "field" && node.id === fieldDefinition.id),
        )
        .map((fieldDefinition) => ({
          id: fieldDefinition.id,
          kind: "field" as const,
          parentId: fieldDefinition.defaultParentId,
          visible: true,
        })),
      ...getRequiredSystemPageIds(fieldDefinitions)
        .filter(
          (pageId) =>
            !defaultConfig.nodes.some((node) => node.kind === "page" && node.id === pageId),
        )
        .flatMap((pageId) => {
          const pageDefinition = getSystemPageDefinition(pageId);

          if (!pageDefinition) {
            return [];
          }

          return [{
            id: pageDefinition.id,
            kind: "page" as const,
            label: pageDefinition.label,
            parentId: null,
            visible: true,
          }];
        }),
    ],
    version: defaultConfig.version,
  };
};

export const materializeProjectEditorPostSidebarConfig = ({
  config,
  contentRuntime,
  supportsPostRevisions,
}: {
  config: ContentPostSidebarConfig;
  contentRuntime: ContentRuntimeSummary | null;
  supportsPostRevisions: boolean;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);
  const fieldDefinitions = getProjectEditorPostSidebarFieldDefinitions({
    contentRuntime,
    supportsPostRevisions,
  });
  const fieldDefinitionById = new Map(
    fieldDefinitions.map((fieldDefinition) => [fieldDefinition.id, fieldDefinition]),
  );
  const nextNodes = normalizedConfig.nodes.filter(
    (node) => node.kind === "page" || fieldDefinitionById.has(node.id),
  );
  const existingPageIds = new Set(
    nextNodes
      .filter((node): node is ContentPostSidebarPageNode => node.kind === "page")
      .map((node) => node.id),
  );
  const existingFieldIds = new Set(
    nextNodes
      .filter((node): node is Extract<ContentPostSidebarNode, { kind: "field" }> => node.kind === "field")
      .map((node) => node.id),
  );

  for (const fieldDefinition of fieldDefinitions) {
    if (existingFieldIds.has(fieldDefinition.id)) {
      continue;
    }

    nextNodes.push({
      id: fieldDefinition.id,
      kind: "field",
      parentId: fieldDefinition.defaultParentId,
      visible: true,
    });
    existingFieldIds.add(fieldDefinition.id);

    if (fieldDefinition.defaultParentId && !existingPageIds.has(fieldDefinition.defaultParentId)) {
      const pageDefinition = getSystemPageDefinition(fieldDefinition.defaultParentId);

      if (pageDefinition) {
        nextNodes.push({
          id: pageDefinition.id,
          kind: "page",
          label: pageDefinition.label,
          parentId: null,
          visible: true,
        });
        existingPageIds.add(pageDefinition.id);
      }
    }
  }

  return normalizeContentPostSidebarConfig({
    nodes: nextNodes.map((node) => {
      if (node.kind === "page") {
        const pageDefinition = getSystemPageDefinition(node.id);

        return {
          ...node,
          label: pageDefinition?.label ?? node.label,
        };
      }

      const fieldDefinition = fieldDefinitionById.get(node.id);
      const nextParentId =
        node.parentId && existingPageIds.has(node.parentId)
          ? node.parentId
          : fieldDefinition?.defaultParentId ?? null;

      return {
        ...node,
        parentId: nextParentId && existingPageIds.has(nextParentId) ? nextParentId : null,
      };
    }),
    version: normalizedConfig.version,
  });
};

export const getProjectEditorResolvedPostSidebarNodes = ({
  config,
  contentRuntime,
  supportsPostRevisions,
}: {
  config: ContentPostSidebarConfig;
  contentRuntime: ContentRuntimeSummary | null;
  supportsPostRevisions: boolean;
}): ProjectEditorResolvedPostSidebarNode[] => {
  const materializedConfig = materializeProjectEditorPostSidebarConfig({
    config,
    contentRuntime,
    supportsPostRevisions,
  });
  const fieldDefinitionById = new Map(
    getProjectEditorPostSidebarFieldDefinitions({
      contentRuntime,
      supportsPostRevisions,
    }).map((fieldDefinition) => [fieldDefinition.id, fieldDefinition]),
  );

  return materializedConfig.nodes.reduce<ProjectEditorResolvedPostSidebarNode[]>((nodes, node) => {
    if (node.kind === "page") {
      nodes.push(node);
      return nodes;
    }

    const fieldDefinition = fieldDefinitionById.get(node.id);

    if (!fieldDefinition) {
      return nodes;
    }

    nodes.push({
      description: fieldDefinition.description,
      id: fieldDefinition.id,
      kind: "field",
      label: fieldDefinition.label,
      parentId: node.parentId,
      visible: node.visible,
    });

    return nodes;
  }, []);
};

export const getProjectEditorPostSidebarChildNodes = ({
  nodes,
  parentId,
}: {
  nodes: ProjectEditorResolvedPostSidebarNode[];
  parentId: string | null;
}) => nodes.filter((node) => node.parentId === parentId);

export const getProjectEditorPostSidebarPageNode = ({
  nodes,
  pageId,
}: {
  nodes: ProjectEditorResolvedPostSidebarNode[];
  pageId: string;
}) => nodes.find((node): node is Extract<ProjectEditorResolvedPostSidebarNode, { kind: "page" }> =>
  node.kind === "page" && node.id === pageId,
);

export const getProjectEditorPostSidebarPageParentId = ({
  nodes,
  pageId,
}: {
  nodes: ProjectEditorResolvedPostSidebarNode[];
  pageId: string;
}) => getProjectEditorPostSidebarPageNode({ nodes, pageId })?.parentId ?? null;

export const getProjectEditorCustomSidebarPageId = (view: PostSidePanelView) =>
  view.startsWith("page:") ? view.slice("page:".length) : null;
