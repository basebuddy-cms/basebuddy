import { describe, expect, it, vi } from "vitest";

import {
  runProjectEditorLinkApply,
  runProjectEditorLinkUnlink,
} from "@/components/editor/project-editor/editor-link-actions";

const createCommandEditor = (selectionEmpty: boolean, isLinkActive = true) => {
  const chainApi = {
    extendMarkRange: vi.fn(() => chainApi),
    focus: vi.fn(() => chainApi),
    run: vi.fn(() => true),
    setLink: vi.fn(() => chainApi),
    setTextSelection: vi.fn(() => chainApi),
    unsetLink: vi.fn(() => chainApi),
  };

  return {
    chainApi,
    editor: {
      chain: vi.fn(() => chainApi),
      isActive: vi.fn((mark: string) => mark === "link" && isLinkActive),
      state: {
        selection: {
          empty: selectionEmpty,
        },
      },
    },
  };
};

describe("project editor link actions", () => {
  it("wraps selected plain text without expanding a non-existent link mark", () => {
    const { chainApi, editor } = createCommandEditor(false, false);

    runProjectEditorLinkApply(editor, {
      href: "https://example.com",
      rel: "noopener noreferrer",
      target: "_blank",
    });

    expect(chainApi.extendMarkRange).not.toHaveBeenCalled();
    expect(chainApi.setLink).toHaveBeenCalledWith({
      href: "https://example.com",
      rel: "noopener noreferrer",
      target: "_blank",
    });
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });

  it("restores the saved text selection in the same chain before applying a new link", () => {
    const { chainApi, editor } = createCommandEditor(true, false);

    runProjectEditorLinkApply(
      editor,
      {
        href: "https://example.com",
        rel: null,
        target: "_blank",
      },
      {
        extendExistingLink: false,
        selection: { from: 3, to: 14 },
      },
    );

    expect(chainApi.focus.mock.invocationCallOrder[0]).toBeLessThan(
      chainApi.setTextSelection.mock.invocationCallOrder[0],
    );
    expect(chainApi.setTextSelection).toHaveBeenCalledWith({ from: 3, to: 14 });
    expect(chainApi.extendMarkRange).not.toHaveBeenCalled();
    expect(chainApi.setLink).toHaveBeenCalledWith({
      href: "https://example.com",
      rel: null,
      target: "_blank",
    });
  });

  it("expands the active link mark before editing an existing link", () => {
    const { chainApi, editor } = createCommandEditor(true, true);

    runProjectEditorLinkApply(editor, {
      href: "https://basebuddy.test",
      rel: null,
      target: null,
    });

    expect(chainApi.extendMarkRange).toHaveBeenCalledWith("link");
    expect(chainApi.setLink).toHaveBeenCalledWith({
      href: "https://basebuddy.test",
      rel: null,
      target: null,
    });
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });

  it("unlinks the whole active link when the cursor is inside it", () => {
    const { chainApi, editor } = createCommandEditor(true);

    runProjectEditorLinkUnlink(editor);

    expect(chainApi.extendMarkRange).toHaveBeenCalledWith("link");
    expect(chainApi.unsetLink).toHaveBeenCalledTimes(1);
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });

  it("uses the saved cursor selection before unlinking a whole active link", () => {
    const { chainApi, editor } = createCommandEditor(false);

    runProjectEditorLinkUnlink(editor, {
      selection: { from: 5, to: 5 },
    });

    expect(chainApi.setTextSelection).toHaveBeenCalledWith({ from: 5, to: 5 });
    expect(chainApi.extendMarkRange).toHaveBeenCalledWith("link");
    expect(chainApi.unsetLink).toHaveBeenCalledTimes(1);
  });

  it("unlinks only the selected linked text when a range is selected", () => {
    const { chainApi, editor } = createCommandEditor(false);

    runProjectEditorLinkUnlink(editor, {
      selection: { from: 5, to: 9 },
    });

    expect(chainApi.extendMarkRange).not.toHaveBeenCalled();
    expect(chainApi.setTextSelection).toHaveBeenCalledWith({ from: 5, to: 9 });
    expect(chainApi.unsetLink).toHaveBeenCalledTimes(1);
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });
});
