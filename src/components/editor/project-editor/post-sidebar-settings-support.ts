import {
  createContentPostSidebarPageId,
  normalizeContentPostSidebarConfig,
  type ContentPostSidebarConfig,
  type ContentPostSidebarNode,
} from "@/lib/content-runtime/shared";

const getNodeId = (node: ContentPostSidebarNode) => `${node.kind}:${node.id}`;

const swapArrayEntries = <T,>(values: T[], leftIndex: number, rightIndex: number) => {
  if (
    leftIndex < 0 ||
    rightIndex < 0 ||
    leftIndex >= values.length ||
    rightIndex >= values.length ||
    leftIndex === rightIndex
  ) {
    return values;
  }

  const nextValues = [...values];
  const [removedValue] = nextValues.splice(leftIndex, 1);
  nextValues.splice(rightIndex, 0, removedValue);
  return nextValues;
};

const getPageDescendantIds = ({
  config,
  pageId,
}: {
  config: ContentPostSidebarConfig;
  pageId: string;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);
  const descendantIds = new Set<string>();
  let foundNextLevel = true;

  while (foundNextLevel) {
    foundNextLevel = false;

    for (const node of normalizedConfig.nodes) {
      if (node.kind !== "page") {
        continue;
      }

      if (node.parentId !== pageId && !descendantIds.has(node.parentId ?? "")) {
        continue;
      }

      if (!descendantIds.has(node.id)) {
        descendantIds.add(node.id);
        foundNextLevel = true;
      }
    }
  }

  return descendantIds;
};

export const getProjectEditorPostSidebarValidationError = (
  config: ContentPostSidebarConfig,
) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);

  if (
    normalizedConfig.nodes.some(
      (node) => node.kind === "page" && !node.label.trim(),
    )
  ) {
    return "Every sidebar page needs a name before you can save.";
  }

  return null;
};

export const getProjectEditorPostSidebarSaveReadiness = ({
  canUpdateProject,
  hasChanges,
  validationError,
}: {
  canUpdateProject: boolean;
  hasChanges: boolean;
  validationError: string | null;
}):
  | { message: null; status: "ready" | "unchanged" }
  | { message: string; status: "blocked" | "invalid" } => {
  if (!canUpdateProject) {
    return {
      message: "You do not have permission to update the sidebar fields.",
      status: "blocked",
    };
  }

  if (validationError) {
    return {
      message: validationError,
      status: "invalid",
    };
  }

  if (!hasChanges) {
    return {
      message: null,
      status: "unchanged",
    };
  }

  return {
    message: null,
    status: "ready",
  };
};

export const runProjectEditorPostSidebarConfigSaveAction = async ({
  canUpdateProject,
  getErrorMessage,
  hasChanges,
  invalidateWorkspaceCache,
  postSidebarConfigDraft,
  projectId,
  saveProjectPostSidebarConfig,
  setIsSavingPostSidebarConfig,
  setPostSidebarConfigDraft,
  setSavedPostSidebarConfig,
  syncPostSidebarWorkspacePayload,
  toastError,
  toastSuccess,
  validationError,
}: {
  canUpdateProject: boolean;
  getErrorMessage: (error: unknown, fallbackMessage: string) => string;
  hasChanges: boolean;
  invalidateWorkspaceCache: () => void;
  postSidebarConfigDraft: ContentPostSidebarConfig;
  projectId: string;
  saveProjectPostSidebarConfig: (input: {
    postSidebarConfig: ContentPostSidebarConfig;
    projectId: string;
  }) => Promise<{
    error?: string;
    postSidebarConfig?: ContentPostSidebarConfig;
  }>;
  setIsSavingPostSidebarConfig: (value: boolean) => void;
  setPostSidebarConfigDraft: (config: ContentPostSidebarConfig) => void;
  setSavedPostSidebarConfig: (config: ContentPostSidebarConfig) => void;
  syncPostSidebarWorkspacePayload: (config: ContentPostSidebarConfig) => void;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
  validationError: string | null;
}) => {
  const saveReadiness = getProjectEditorPostSidebarSaveReadiness({
    canUpdateProject,
    hasChanges,
    validationError,
  });

  if (saveReadiness.status === "blocked" || saveReadiness.status === "invalid") {
    toastError(saveReadiness.message);
    return;
  }

  if (saveReadiness.status === "unchanged") {
    return;
  }

  setIsSavingPostSidebarConfig(true);

  try {
    const payload = await saveProjectPostSidebarConfig({
      postSidebarConfig: postSidebarConfigDraft,
      projectId,
    });

    if (!payload.postSidebarConfig) {
      throw new Error(payload.error ?? "Could not save the sidebar layout right now.");
    }

    setSavedPostSidebarConfig(payload.postSidebarConfig);
    setPostSidebarConfigDraft(payload.postSidebarConfig);
    syncPostSidebarWorkspacePayload(payload.postSidebarConfig);
    invalidateWorkspaceCache();
    toastSuccess("Sidebar layout saved.");
  } catch (error) {
    toastError(getErrorMessage(error, "Could not save the sidebar layout right now."));
  } finally {
    setIsSavingPostSidebarConfig(false);
  }
};

export const getProjectEditorPostSidebarChildNodes = ({
  config,
  parentId,
}: {
  config: ContentPostSidebarConfig;
  parentId: string | null;
}) =>
  normalizeContentPostSidebarConfig(config).nodes.filter((node) => node.parentId === parentId);

export const createProjectEditorPostSidebarPage = ({
  config,
  label,
}: {
  config: ContentPostSidebarConfig;
  label: string;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);
  const trimmedLabel = label.trim().replace(/\s+/g, " ");

  if (!trimmedLabel) {
    return normalizedConfig;
  }

  const pageId = createContentPostSidebarPageId({
    existingIds: normalizedConfig.nodes.flatMap((node) => (node.kind === "page" ? [node.id] : [])),
    label: trimmedLabel,
  });

  return normalizeContentPostSidebarConfig({
    nodes: [
      ...normalizedConfig.nodes,
      {
        id: pageId,
        kind: "page",
        label: trimmedLabel,
        parentId: null,
        visible: true,
      },
    ],
    version: normalizedConfig.version,
  });
};

export const renameProjectEditorPostSidebarPage = ({
  config,
  label,
  pageId,
}: {
  config: ContentPostSidebarConfig;
  label: string;
  pageId: string;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);

  return normalizeContentPostSidebarConfig({
    nodes: normalizedConfig.nodes.map((node) =>
      node.kind === "page" && node.id === pageId
        ? {
            ...node,
            label,
          }
        : node,
    ),
    version: normalizedConfig.version,
  });
};

export const toggleProjectEditorPostSidebarNodeVisibility = ({
  config,
  nodeId,
}: {
  config: ContentPostSidebarConfig;
  nodeId: string;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);

  return normalizeContentPostSidebarConfig({
    nodes: normalizedConfig.nodes.map((node) =>
      getNodeId(node) === nodeId
        ? {
            ...node,
            visible: !node.visible,
          }
        : node,
    ),
    version: normalizedConfig.version,
  });
};

export const moveProjectEditorPostSidebarNode = ({
  config,
  direction,
  nodeId,
}: {
  config: ContentPostSidebarConfig;
  direction: "down" | "up";
  nodeId: string;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);
  const currentIndex = normalizedConfig.nodes.findIndex((node) => getNodeId(node) === nodeId);
  const currentNode = normalizedConfig.nodes[currentIndex] ?? null;

  if (!currentNode) {
    return normalizedConfig;
  }

  const siblingIndexes = normalizedConfig.nodes.flatMap((node, index) =>
    node.parentId === currentNode.parentId ? [index] : [],
  );
  const siblingIndex = siblingIndexes.findIndex((index) => index === currentIndex);
  const targetSiblingIndex = direction === "up" ? siblingIndex - 1 : siblingIndex + 1;

  if (
    siblingIndex < 0 ||
    targetSiblingIndex < 0 ||
    targetSiblingIndex >= siblingIndexes.length
  ) {
    return normalizedConfig;
  }

  return normalizeContentPostSidebarConfig({
    nodes: swapArrayEntries(
      normalizedConfig.nodes,
      siblingIndexes[siblingIndex] ?? -1,
      siblingIndexes[targetSiblingIndex] ?? -1,
    ),
    version: normalizedConfig.version,
  });
};

export const setProjectEditorPostSidebarNodeParent = ({
  config,
  nodeId,
  parentId,
}: {
  config: ContentPostSidebarConfig;
  nodeId: string;
  parentId: string | null;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);
  const currentNode = normalizedConfig.nodes.find((node) => getNodeId(node) === nodeId) ?? null;
  const normalizedTargetParentId =
    parentId &&
    normalizedConfig.nodes.some((node) => node.kind === "page" && node.id === parentId)
      ? parentId
      : null;

  if (!currentNode) {
    return normalizedConfig;
  }

  if (
    currentNode.kind === "page" &&
    normalizedTargetParentId &&
    getPageDescendantIds({
      config: normalizedConfig,
      pageId: currentNode.id,
    }).has(normalizedTargetParentId)
  ) {
    return normalizedConfig;
  }

  if (currentNode.parentId === normalizedTargetParentId) {
    return normalizedConfig;
  }

  const remainingNodes = normalizedConfig.nodes.filter((node) => getNodeId(node) !== nodeId);
  const insertionIndex =
    remainingNodes.reduce(
      (lastMatchingIndex, node, index) =>
        node.parentId === normalizedTargetParentId ? index : lastMatchingIndex,
      -1,
    ) + 1;
  const nextNodes = [...remainingNodes];
  nextNodes.splice(insertionIndex, 0, {
    ...currentNode,
    parentId: normalizedTargetParentId,
  });

  return normalizeContentPostSidebarConfig({
    nodes: nextNodes,
    version: normalizedConfig.version,
  });
};

export const removeProjectEditorPostSidebarPage = ({
  config,
  pageId,
}: {
  config: ContentPostSidebarConfig;
  pageId: string;
}) => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);
  const pageNode = normalizedConfig.nodes.find(
    (node): node is Extract<ContentPostSidebarNode, { kind: "page" }> =>
      node.kind === "page" && node.id === pageId,
  );

  if (!pageNode) {
    return normalizedConfig;
  }

  return normalizeContentPostSidebarConfig({
    nodes: normalizedConfig.nodes
      .filter((node) => !(node.kind === "page" && node.id === pageId))
      .map((node) =>
        node.parentId === pageId
          ? {
              ...node,
              parentId: pageNode.parentId,
            }
          : node,
      ),
    version: normalizedConfig.version,
  });
};
