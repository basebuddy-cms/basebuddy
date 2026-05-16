import { describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";

import {
  runProjectEditorFileInsert,
  runProjectEditorImageRemove,
  runProjectEditorImageAttributeUpdate,
  runProjectEditorImageInsert,
} from "@/components/editor/project-editor/editor-asset-insert-actions";
import { createContentRuntimeEditorExtensions } from "@/lib/content-runtime/editor-extensions";

const createCommandEditor = (selectionEmpty: boolean) => {
  const chainApi = {
    focus: vi.fn(() => chainApi),
    deleteSelection: vi.fn(() => chainApi),
    insertContent: vi.fn(() => chainApi),
    run: vi.fn(() => true),
    setImage: vi.fn(() => chainApi),
    setLink: vi.fn(() => chainApi),
    updateAttributes: vi.fn(() => chainApi),
  };

  return {
    chainApi,
    editor: {
      chain: vi.fn(() => chainApi),
      state: {
        selection: {
          empty: selectionEmpty,
        },
      },
    },
  };
};

describe("project editor asset insert actions", () => {
  it("inserts a selected media item as an image node", () => {
    const { chainApi, editor } = createCommandEditor(true);

    runProjectEditorImageInsert(editor, {
      alt: "Hero image",
      src: "https://assets.test/hero.png",
    });

    expect(chainApi.focus).toHaveBeenCalledTimes(1);
    expect(chainApi.setImage).toHaveBeenCalledWith({
      alt: "Hero image",
      src: "https://assets.test/hero.png",
    });
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });

  it("inserts a selected file as linked text when no text is selected", () => {
    const { chainApi, editor } = createCommandEditor(true);

    runProjectEditorFileInsert(editor, {
      fileName: "Launch checklist.pdf",
      href: "https://assets.test/launch-checklist.pdf",
    });

    expect(chainApi.insertContent).toHaveBeenCalledWith({
      marks: [
        {
          attrs: {
            href: "https://assets.test/launch-checklist.pdf",
            rel: "noopener noreferrer",
            target: "_blank",
          },
          type: "link",
        },
      ],
      text: "Launch checklist.pdf",
      type: "text",
    });
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });

  it("links selected text to the selected file instead of inserting duplicate text", () => {
    const { chainApi, editor } = createCommandEditor(false);

    runProjectEditorFileInsert(editor, {
      fileName: "Brand guide.pdf",
      href: "https://assets.test/brand-guide.pdf",
    });

    expect(chainApi.insertContent).not.toHaveBeenCalled();
    expect(chainApi.setLink).toHaveBeenCalledWith({
      href: "https://assets.test/brand-guide.pdf",
      rel: "noopener noreferrer",
      target: "_blank",
    });
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });

  it("updates the selected image node attributes", () => {
    const { chainApi, editor } = createCommandEditor(true);

    runProjectEditorImageAttributeUpdate(editor, {
      alt: "Cover",
      align: "center",
      height: "480",
      linkHref: "https://example.com/cover",
      width: "720",
    });

    expect(chainApi.updateAttributes).toHaveBeenCalledWith("image", {
      alt: "Cover",
      align: "center",
      height: "480",
      linkHref: "https://example.com/cover",
      width: "720",
    });
    expect(chainApi.focus).not.toHaveBeenCalled();
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });

  it("updates image attributes without moving text input focus back to the editor", () => {
    const editor = new Editor({
      content: {
        content: [
          {
            content: [{ text: "Intro", type: "text" }],
            type: "paragraph",
          },
          {
            attrs: {
              alt: "",
              src: "https://assets.test/hero.png",
            },
            type: "image",
          },
          {
            content: [{ text: "After", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      extensions: createContentRuntimeEditorExtensions(),
    });

    let imagePosition: number | null = null;
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "image") {
        imagePosition = position;
        return false;
      }

      return true;
    });

    expect(imagePosition).not.toBeNull();
    editor.commands.setNodeSelection(imagePosition!);
    editor.commands.blur();

    runProjectEditorImageAttributeUpdate(editor, {
      alt: "Updated hero image",
      linkHref: "https://example.com",
    });

    expect(editor.isFocused).toBe(false);
    expect(editor.getHTML()).toContain('alt="Updated hero image"');
    expect(editor.getHTML()).toContain('src="https://assets.test/hero.png"');
    expect(editor.getHTML()).toContain('href="https://example.com"');

    editor.destroy();
  });

  it("removes the selected image node", () => {
    const { chainApi, editor } = createCommandEditor(true);

    runProjectEditorImageRemove(editor);

    expect(chainApi.deleteSelection).toHaveBeenCalledTimes(1);
    expect(chainApi.run).toHaveBeenCalledTimes(1);
  });
});
