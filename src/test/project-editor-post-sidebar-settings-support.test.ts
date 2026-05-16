import { describe, expect, it } from "vitest";

import {
  createProjectEditorPostSidebarPage,
  getProjectEditorPostSidebarSaveReadiness,
  moveProjectEditorPostSidebarNode,
  removeProjectEditorPostSidebarPage,
  runProjectEditorPostSidebarConfigSaveAction,
  setProjectEditorPostSidebarNodeParent,
} from "@/components/editor/project-editor/post-sidebar-settings-support";
import { createDefaultContentPostSidebarConfig } from "@/lib/content-runtime/shared";

describe("project editor post sidebar settings support", () => {
  it("adds custom pages as root nodes", () => {
    const config = createProjectEditorPostSidebarPage({
      config: createDefaultContentPostSidebarConfig(),
      label: "Editorial",
    });

    expect(config.nodes.at(-1)).toEqual({
      id: "editorial",
      kind: "page",
      label: "Editorial",
      parentId: null,
      visible: true,
    });
  });

  it("moves fields and pages under parent pages", () => {
    const withPage = createProjectEditorPostSidebarPage({
      config: createDefaultContentPostSidebarConfig(),
      label: "Editorial",
    });
    const withNestedField = setProjectEditorPostSidebarNodeParent({
      config: withPage,
      nodeId: "field:author",
      parentId: "editorial",
    });
    const withNestedPage = setProjectEditorPostSidebarNodeParent({
      config: withNestedField,
      nodeId: "page:meta-fields",
      parentId: "editorial",
    });

    expect(withNestedPage.nodes.find((node) => node.kind === "field" && node.id === "author")).toEqual({
      id: "author",
      kind: "field",
      parentId: "editorial",
      visible: true,
    });
    expect(withNestedPage.nodes.find((node) => node.kind === "page" && node.id === "meta-fields")).toEqual({
      id: "meta-fields",
      kind: "page",
      label: "Meta Fields",
      parentId: "editorial",
      visible: true,
    });
  });

  it("prevents nested page cycles", () => {
    const withPage = createProjectEditorPostSidebarPage({
      config: createDefaultContentPostSidebarConfig(),
      label: "Editorial",
    });
    const withMetaUnderEditorial = setProjectEditorPostSidebarNodeParent({
      config: withPage,
      nodeId: "page:meta-fields",
      parentId: "editorial",
    });

    const config = setProjectEditorPostSidebarNodeParent({
      config: withMetaUnderEditorial,
      nodeId: "page:editorial",
      parentId: "meta-fields",
    });

    expect(config).toEqual(withMetaUnderEditorial);
  });

  it("hoists children to the deleted page parent", () => {
    const withPage = createProjectEditorPostSidebarPage({
      config: createDefaultContentPostSidebarConfig(),
      label: "Editorial",
    });
    const withMetaUnderEditorial = setProjectEditorPostSidebarNodeParent({
      config: withPage,
      nodeId: "page:meta-fields",
      parentId: "editorial",
    });
    const withFieldUnderMeta = setProjectEditorPostSidebarNodeParent({
      config: withMetaUnderEditorial,
      nodeId: "field:meta_title",
      parentId: "meta-fields",
    });

    const config = removeProjectEditorPostSidebarPage({
      config: withFieldUnderMeta,
      pageId: "meta-fields",
    });

    expect(config.nodes.some((node) => node.kind === "page" && node.id === "meta-fields")).toBe(false);
    expect(config.nodes.find((node) => node.kind === "field" && node.id === "meta_title")?.parentId).toBe("editorial");
  });

  it("reorders nodes among siblings without changing parentage", () => {
    const config = moveProjectEditorPostSidebarNode({
      config: createDefaultContentPostSidebarConfig(),
      direction: "down",
      nodeId: "field:author",
    });

    expect(config.nodes[0]).toEqual({
      id: "published_at",
      kind: "field",
      parentId: null,
      visible: true,
    });
    expect(config.nodes[1]).toEqual({
      id: "author",
      kind: "field",
      parentId: null,
      visible: true,
    });
  });

  it("keeps sidebar save readiness decisions outside the editor shell", () => {
    expect(
      getProjectEditorPostSidebarSaveReadiness({
        canUpdateProject: false,
        hasChanges: true,
        validationError: null,
      }),
    ).toEqual({
      message: "You do not have permission to update the sidebar fields.",
      status: "blocked",
    });
    expect(
      getProjectEditorPostSidebarSaveReadiness({
        canUpdateProject: true,
        hasChanges: true,
        validationError: "Every sidebar page needs a name before you can save.",
      }),
    ).toEqual({
      message: "Every sidebar page needs a name before you can save.",
      status: "invalid",
    });
    expect(
      getProjectEditorPostSidebarSaveReadiness({
        canUpdateProject: true,
        hasChanges: false,
        validationError: null,
      }),
    ).toEqual({
      message: null,
      status: "unchanged",
    });
    expect(
      getProjectEditorPostSidebarSaveReadiness({
        canUpdateProject: true,
        hasChanges: true,
        validationError: null,
      }),
    ).toEqual({
      message: null,
      status: "ready",
    });
  });

  it("runs sidebar save mutation orchestration outside the editor shell", async () => {
    const postSidebarConfig = createDefaultContentPostSidebarConfig();
    const savingStates: boolean[] = [];
    const savedConfigs: unknown[] = [];
    const draftConfigs: unknown[] = [];
    const syncedConfigs: unknown[] = [];
    const invalidated: string[] = [];
    const toastSuccesses: string[] = [];
    const toastErrors: string[] = [];

    await runProjectEditorPostSidebarConfigSaveAction({
      canUpdateProject: true,
      getErrorMessage: (error, fallback) => (error instanceof Error ? error.message : fallback),
      hasChanges: true,
      invalidateWorkspaceCache: () => invalidated.push("workspace"),
      postSidebarConfigDraft: postSidebarConfig,
      projectId: "project-1",
      saveProjectPostSidebarConfig: async () => ({ postSidebarConfig }),
      setIsSavingPostSidebarConfig: (value) => savingStates.push(value),
      setPostSidebarConfigDraft: (config) => draftConfigs.push(config),
      setSavedPostSidebarConfig: (config) => savedConfigs.push(config),
      syncPostSidebarWorkspacePayload: (config) => syncedConfigs.push(config),
      toastError: (message) => toastErrors.push(message),
      toastSuccess: (message) => toastSuccesses.push(message),
      validationError: null,
    });

    expect(savingStates).toEqual([true, false]);
    expect(savedConfigs).toEqual([postSidebarConfig]);
    expect(draftConfigs).toEqual([postSidebarConfig]);
    expect(syncedConfigs).toEqual([postSidebarConfig]);
    expect(invalidated).toEqual(["workspace"]);
    expect(toastSuccesses).toEqual(["Sidebar layout saved."]);
    expect(toastErrors).toEqual([]);
  });
});
