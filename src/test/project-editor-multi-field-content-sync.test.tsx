import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  editorMock,
  normalizeContentRuntimePostContentFieldValueMock,
  useEditorMock,
} = vi.hoisted(() => {
  const editor = {
    commands: {
      setContent: vi.fn(),
    },
    getJSON: vi.fn(),
    setEditable: vi.fn(),
  };

  return {
    editorMock: editor,
    normalizeContentRuntimePostContentFieldValueMock: vi.fn(),
    useEditorMock: vi.fn(() => editor),
  };
});

vi.mock("@tiptap/react", () => ({
  EditorContent: () => <div data-testid="editor-content" />,
  useEditor: useEditorMock,
}));

vi.mock("@/lib/content-runtime/content-conversion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-runtime/content-conversion")>(
    "@/lib/content-runtime/content-conversion",
  );

  return {
    ...actual,
    normalizeContentRuntimePostContentFieldValue: normalizeContentRuntimePostContentFieldValueMock,
  };
});

import { ProjectEditorMultiFieldEditorBody } from "@/components/editor/project-editor/collection-body";

describe("project editor multi-field content sync", () => {
  it("does not replace valid live editor json with a canonicalized prop echo", () => {
    const liveEditorJson = {
      content: [
        {
          attrs: { textAlign: null },
          content: [{ text: "/alpha ", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    };
    const canonicalizedJson = {
      content: [{ type: "paragraph" }],
      type: "doc",
    };

    editorMock.getJSON.mockReturnValue(liveEditorJson);
    normalizeContentRuntimePostContentFieldValueMock.mockReturnValue({
      contentHtml: "<p>/alpha </p>",
      contentJson: canonicalizedJson,
    });

    render(
      <ProjectEditorMultiFieldEditorBody
        canEditCurrentPost
        contentFields={{
          body: {
            contentHtml: "<p>/alpha </p>",
            contentJson: liveEditorJson,
          },
        }}
        currentPostReadOnlyMessage={null}
        mainFieldSpecs={[
          {
            allowedValues: null,
            contentFormat: "html",
            editabilityState: "editable",
            fieldKey: "body",
            label: "Body",
            multiple: false,
            nullable: true,
            patchMode: "replace",
            readOnly: false,
            relationMode: "none",
            required: false,
            searchMode: "none",
            semanticRole: "content",
            uiControl: "content_editor",
            valueKind: "content",
            visible: true,
          },
        ]}
        isCurrentPostReadOnly={false}
        onContentFieldChange={vi.fn()}
        onEditorFocus={vi.fn()}
        onEditorInstanceChange={vi.fn()}
        onEditorKeyDown={vi.fn(() => false)}
        onEditorLinkClick={vi.fn()}
        onEditorStateChange={vi.fn()}
        onRetryCurrentPostEditAccess={vi.fn()}
        onTitleChange={vi.fn()}
        onTitleKeyDown={vi.fn()}
        onTitlePaste={vi.fn()}
        selectedPostId="post-1"
        selectedPostTitle="Post"
        titleTextareaRef={vi.fn()}
      />,
    );

    expect(editorMock.commands.setContent).not.toHaveBeenCalled();
  });
});
