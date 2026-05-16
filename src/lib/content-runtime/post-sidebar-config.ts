const CONTENT_POST_SIDEBAR_CONFIG_VERSION = 2 as const;

export const contentPostSidebarFieldKeys = [
  "author",
  "parent_page",
  "published_at",
  "updated_at",
  "excerpt",
  "slug",
  "redirects",
  "featured_image",
  "preview",
  "revisions",
  "categories",
  "tags",
  "focus_keyword",
  "seo_analysis",
  "readability_analysis",
  "meta_title",
  "meta_description",
] as const;

export type ContentBuiltinPostSidebarFieldKey = (typeof contentPostSidebarFieldKeys)[number];
export type ContentPostSidebarFieldKey =
  | ContentBuiltinPostSidebarFieldKey
  | `custom_field:${string}`;

export type ContentPostSidebarFieldNode = {
  id: ContentPostSidebarFieldKey;
  kind: "field";
  parentId: string | null;
  visible: boolean;
};

export type ContentPostSidebarPageNode = {
  id: string;
  kind: "page";
  label: string;
  parentId: string | null;
  visible: boolean;
};

export type ContentPostSidebarNode =
  | ContentPostSidebarFieldNode
  | ContentPostSidebarPageNode;

export type ContentPostSidebarPage = ContentPostSidebarPageNode;
export type ContentPostSidebarItem = ContentPostSidebarFieldNode;

export type ContentPostSidebarConfig = {
  nodes: ContentPostSidebarNode[];
  version: typeof CONTENT_POST_SIDEBAR_CONFIG_VERSION;
};

const contentPostSidebarFieldKeySet = new Set<string>(contentPostSidebarFieldKeys);

const normalizeSidebarPageId = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || null;
};

const normalizeSidebarPageLabel = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
};

const normalizeSidebarFieldId = (value: unknown): ContentPostSidebarFieldKey | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (contentPostSidebarFieldKeySet.has(normalizedValue)) {
    return normalizedValue as ContentBuiltinPostSidebarFieldKey;
  }

  if (normalizedValue.startsWith("custom_field:") && normalizedValue.slice("custom_field:".length).trim()) {
    return normalizedValue as `custom_field:${string}`;
  }

  return null;
};

const normalizeSidebarParentPageId = ({
  pageIds,
  value,
}: {
  pageIds: Set<string>;
  value: unknown;
}) => {
  const normalizedParentId = normalizeSidebarPageId(value);
  return normalizedParentId && pageIds.has(normalizedParentId) ? normalizedParentId : null;
};

const toSidebarBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const createDefaultSidebarNodes = (): ContentPostSidebarNode[] => [
  { id: "author", kind: "field", parentId: null, visible: true },
  { id: "published_at", kind: "field", parentId: null, visible: true },
  { id: "updated_at", kind: "field", parentId: null, visible: true },
  { id: "excerpt", kind: "field", parentId: null, visible: true },
  { id: "slug", kind: "field", parentId: null, visible: true },
  { id: "featured_image", kind: "field", parentId: null, visible: true },
  { id: "preview", kind: "field", parentId: null, visible: true },
  { id: "revisions", kind: "field", parentId: null, visible: true },
  { id: "categories", kind: "field", parentId: null, visible: true },
  { id: "tags", kind: "field", parentId: null, visible: true },
  { id: "seo-fields", kind: "page", label: "SEO Fields", parentId: null, visible: true },
  { id: "focus_keyword", kind: "field", parentId: "seo-fields", visible: true },
  { id: "seo_analysis", kind: "field", parentId: "seo-fields", visible: true },
  { id: "readability_analysis", kind: "field", parentId: "seo-fields", visible: true },
  { id: "meta-fields", kind: "page", label: "Meta Fields", parentId: null, visible: true },
  { id: "meta_title", kind: "field", parentId: "meta-fields", visible: true },
  { id: "meta_description", kind: "field", parentId: "meta-fields", visible: true },
];

const getLegacySystemPageNode = ({
  fieldKey,
  parentId,
  visible,
}: {
  fieldKey: string;
  parentId: string | null;
  visible: boolean;
}): ContentPostSidebarPageNode | null => {
  if (fieldKey === "seo") {
    return {
      id: "seo-fields",
      kind: "page",
      label: "SEO Fields",
      parentId,
      visible,
    };
  }

  if (fieldKey === "meta") {
    return {
      id: "meta-fields",
      kind: "page",
      label: "Meta Fields",
      parentId,
      visible,
    };
  }

  if (fieldKey === "custom_fields") {
    return {
      id: "custom-fields",
      kind: "page",
      label: "Custom Fields",
      parentId,
      visible,
    };
  }

  return null;
};

const convertLegacyPostSidebarConfig = (value: {
  items?: unknown;
  pages?: unknown;
  rootEntries?: unknown;
}) => {
  const legacyPages = Array.isArray(value.pages)
    ? value.pages.flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const pageRecord = entry as {
          id?: unknown;
          label?: unknown;
          visible?: unknown;
        };
        const normalizedId = normalizeSidebarPageId(pageRecord.id);
        const normalizedLabel = normalizeSidebarPageLabel(pageRecord.label);

        if (!normalizedId || !normalizedLabel) {
          return [];
        }

        return [{
          id: normalizedId,
          kind: "page",
          label: normalizedLabel,
          parentId: null,
          visible: toSidebarBoolean(pageRecord.visible, true),
        }] satisfies ContentPostSidebarPageNode[];
      })
    : [];
  const legacyPageIds = new Set(legacyPages.map((page) => page.id));
  const legacyItems = Array.isArray(value.items)
    ? value.items.flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const itemRecord = entry as {
          key?: unknown;
          pageId?: unknown;
          visible?: unknown;
        };
        const normalizedKey = typeof itemRecord.key === "string" ? itemRecord.key.trim() : "";

        if (!normalizedKey) {
          return [];
        }

        return [{
          key: normalizedKey,
          pageId: normalizeSidebarParentPageId({
            pageIds: legacyPageIds,
            value: itemRecord.pageId,
          }),
          visible: toSidebarBoolean(itemRecord.visible, true),
        }];
      })
    : [];
  const seenNodeIds = new Set<string>();
  const nextNodes: ContentPostSidebarNode[] = [];

  const addNode = (node: ContentPostSidebarNode | null) => {
    if (!node) {
      return;
    }

    const nodeId = `${node.kind}:${node.id}`;

    if (seenNodeIds.has(nodeId)) {
      return;
    }

    seenNodeIds.add(nodeId);
    nextNodes.push(node);
  };

  const addLegacyFieldOrPage = ({
    key,
    parentId,
    visible,
  }: {
    key: string;
    parentId: string | null;
    visible: boolean;
  }) => {
    const legacySystemPageNode = getLegacySystemPageNode({
      fieldKey: key,
      parentId,
      visible,
    });

    if (legacySystemPageNode) {
      addNode(legacySystemPageNode);
      return;
    }

    const normalizedFieldId = normalizeSidebarFieldId(key);

    if (!normalizedFieldId) {
      return;
    }

    addNode({
      id: normalizedFieldId,
      kind: "field",
      parentId,
      visible,
    });
  };

  if (Array.isArray(value.rootEntries)) {
    for (const entry of value.rootEntries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const rootEntryRecord = entry as {
        key?: unknown;
        pageId?: unknown;
        type?: unknown;
      };

      if (rootEntryRecord.type === "page") {
        const normalizedPageId = normalizeSidebarPageId(rootEntryRecord.pageId);
        const matchingPage = legacyPages.find((page) => page.id === normalizedPageId) ?? null;

        addNode(matchingPage);
        continue;
      }

      addLegacyFieldOrPage({
        key: typeof rootEntryRecord.key === "string" ? rootEntryRecord.key : "",
        parentId: null,
        visible: true,
      });
    }
  }

  for (const page of legacyPages) {
    addNode(page);
  }

  for (const item of legacyItems) {
    addLegacyFieldOrPage({
      key: item.key,
      parentId: item.pageId,
      visible: item.visible,
    });
  }

  return nextNodes.length ? nextNodes : createDefaultSidebarNodes();
};

const sanitizeSidebarNodes = (nodes: ContentPostSidebarNode[]) => {
  const seenPageIds = new Set<string>();
  const seenFieldIds = new Set<string>();
  const nextNodes: ContentPostSidebarNode[] = [];

  for (const node of nodes) {
    if (node.kind === "page") {
      if (seenPageIds.has(node.id)) {
        continue;
      }

      seenPageIds.add(node.id);
      nextNodes.push(node);
      continue;
    }

    if (seenFieldIds.has(node.id)) {
      continue;
    }

    seenFieldIds.add(node.id);
    nextNodes.push(node);
  }

  const originalPageById = new Map(
    nextNodes
      .filter((node): node is ContentPostSidebarPageNode => node.kind === "page")
      .map((node) => [node.id, node]),
  );
  const sanitizedPageParentById = new Map<string, string | null>();
  const getSanitizedPageParentId = ({
    nodeId,
    parentId,
  }: {
    nodeId: string;
    parentId: string | null;
  }) => {
    if (!parentId || !originalPageById.has(parentId) || parentId === nodeId) {
      return null;
    }

    const seenIds = new Set<string>([nodeId]);
    let currentParentId: string | null = parentId;

    while (currentParentId) {
      if (seenIds.has(currentParentId)) {
        return null;
      }

      seenIds.add(currentParentId);

      if (sanitizedPageParentById.has(currentParentId)) {
        currentParentId = sanitizedPageParentById.get(currentParentId) ?? null;
        continue;
      }

      currentParentId = originalPageById.get(currentParentId)?.parentId ?? null;
    }

    return parentId;
  };

  for (const node of nextNodes) {
    if (node.kind === "page") {
      sanitizedPageParentById.set(
        node.id,
        getSanitizedPageParentId({
          nodeId: node.id,
          parentId: node.parentId,
        }),
      );
    }
  }

  return nextNodes.map((node) =>
    node.kind === "page"
      ? {
          ...node,
          parentId: sanitizedPageParentById.get(node.id) ?? null,
        }
      : {
          ...node,
          parentId: node.parentId && sanitizedPageParentById.has(node.parentId) ? node.parentId : null,
        },
  );
};

export const createDefaultContentPostSidebarConfig = (): ContentPostSidebarConfig => ({
  nodes: createDefaultSidebarNodes(),
  version: CONTENT_POST_SIDEBAR_CONFIG_VERSION,
});

export const cloneContentPostSidebarConfig = (
  config: ContentPostSidebarConfig,
): ContentPostSidebarConfig =>
  JSON.parse(JSON.stringify(config)) as ContentPostSidebarConfig;

export const normalizeContentPostSidebarConfig = (
  value: unknown,
): ContentPostSidebarConfig => {
  const fallback = createDefaultContentPostSidebarConfig();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as {
    items?: unknown;
    nodes?: unknown;
    pages?: unknown;
    rootEntries?: unknown;
  };
  const normalizedNodes: ContentPostSidebarNode[] = Array.isArray(record.nodes)
    ? record.nodes.reduce<ContentPostSidebarNode[]>((nodes, entry) => {
        if (!entry || typeof entry !== "object") {
          return nodes;
        }

        const nodeRecord = entry as {
          id?: unknown;
          kind?: unknown;
          label?: unknown;
          parentId?: unknown;
          visible?: unknown;
        };

        if (nodeRecord.kind === "page") {
          const normalizedId = normalizeSidebarPageId(nodeRecord.id);
          const normalizedLabel = normalizeSidebarPageLabel(nodeRecord.label);

          if (!normalizedId || !normalizedLabel) {
            return nodes;
          }

          nodes.push({
            id: normalizedId,
            kind: "page",
            label: normalizedLabel,
            parentId: normalizeSidebarPageId(nodeRecord.parentId),
            visible: toSidebarBoolean(nodeRecord.visible, true),
          });

          return nodes;
        }

        const normalizedFieldId = normalizeSidebarFieldId(nodeRecord.id);

        if (!normalizedFieldId) {
          return nodes;
        }

        nodes.push({
          id: normalizedFieldId,
          kind: "field",
          parentId: normalizeSidebarPageId(nodeRecord.parentId),
          visible: toSidebarBoolean(nodeRecord.visible, true),
        });

        return nodes;
      }, [])
    : convertLegacyPostSidebarConfig(record);
  const sanitizedNodes = sanitizeSidebarNodes(normalizedNodes);

  return {
    nodes: sanitizedNodes.length ? sanitizedNodes : fallback.nodes,
    version: CONTENT_POST_SIDEBAR_CONFIG_VERSION,
  };
};

export const createContentPostSidebarPageId = ({
  existingIds,
  label,
}: {
  existingIds: string[];
  label: string;
}) => {
  const normalizedLabel = normalizeSidebarPageLabel(label) ?? "page";
  const baseId = normalizeSidebarPageId(normalizedLabel) ?? "page";
  const existingIdSet = new Set(existingIds.map((entry) => normalizeSidebarPageId(entry)).filter(Boolean));

  if (!existingIdSet.has(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (existingIdSet.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
};

export const areContentPostSidebarConfigsEqual = (
  left: ContentPostSidebarConfig,
  right: ContentPostSidebarConfig,
) =>
  JSON.stringify(normalizeContentPostSidebarConfig(left)) ===
  JSON.stringify(normalizeContentPostSidebarConfig(right));
