import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { editorMock, useEditorMock } = vi.hoisted(() => {
  const editor = {
    commands: {
      setContent: vi.fn(),
    },
    getJSON: vi.fn(() => ({ content: [], type: "doc" })),
    setEditable: vi.fn(),
  };

  return {
    editorMock: editor,
    useEditorMock: vi.fn(() => editor),
  };
});

vi.mock("@tiptap/react", () => ({
  EditorContent: () => <div data-testid="editor-content" />,
  useEditor: useEditorMock,
}));

import {
  ProjectEditorMultiFieldEditorBody,
  ProjectEditorPostEditorBody,
} from "@/components/editor/project-editor/collection-body";

describe("project editor multi-field layout", () => {
  it("uses a structural full-width divider and a nine-line default content area for each field", () => {
    render(
      <ProjectEditorMultiFieldEditorBody
        canEditCurrentPost
        contentFields={{}}
        currentPostReadOnlyMessage={null}
        mainFieldSpecs={[
          {
            allowedValues: null,
            contentFormat: null,
            editabilityState: "editable",
            fieldKey: "headline_text",
            label: "Headline",
            multiple: false,
            nullable: false,
            patchMode: "replace",
            readOnly: false,
            relationMode: "none",
            required: true,
            searchMode: "none",
            semanticRole: "title",
            uiControl: "text_input",
            valueKind: "text_like",
            visible: true,
          },
          {
            allowedValues: null,
            contentFormat: "html",
            editabilityState: "editable",
            fieldKey: "intro",
            label: "Intro",
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
            required: true,
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

    const introField = screen.getByTestId("content-field-intro");
    const bodyField = screen.getByTestId("content-field-body");
    const bodyFieldShell = screen.getByTestId("content-field-shell-body");

    expect(screen.queryByTestId("content-field-divider-intro")).not.toBeInTheDocument();
    expect(bodyField).toHaveClass("w-full");
    expect(screen.getByTestId("content-field-divider-body")).toHaveClass("h-[3px]", "w-full");
    expect(bodyField.firstElementChild).toBe(screen.getByTestId("content-field-divider-body"));
    expect(bodyFieldShell).toHaveClass("mx-auto", "max-w-2xl", "px-8", "pt-10");
    expect(introField.querySelector(".prose-editor")).toHaveClass("min-h-[15.75rem]");
  });

  it("hides the title textarea when the adapter does not expose a visible title field", () => {
    render(
      <ProjectEditorMultiFieldEditorBody
        canEditCurrentPost
        contentFields={{}}
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

    expect(screen.queryByLabelText("Post title")).not.toBeInTheDocument();
  });

  it("renders content sections from the compiled field specs only", () => {
    render(
      <ProjectEditorMultiFieldEditorBody
        canEditCurrentPost
        contentFields={{}}
        currentPostReadOnlyMessage={null}
        mainFieldSpecs={[
          {
            allowedValues: null,
            contentFormat: "html",
            editabilityState: "editable",
            fieldKey: "summary",
            label: "Summary",
            multiple: false,
            nullable: true,
            patchMode: "replace",
            readOnly: false,
            relationMode: "none",
            required: false,
            searchMode: "none",
            semanticRole: "excerpt",
            uiControl: "textarea",
            valueKind: "long_text",
            visible: true,
          },
          {
            allowedValues: null,
            contentFormat: "html",
            editabilityState: "editable",
            fieldKey: "body_html",
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

    expect(screen.getByTestId("content-field-body_html")).toBeInTheDocument();
    expect(screen.queryByTestId("content-field-summary")).not.toBeInTheDocument();
  });

  it("hides the single-editor body when the compiled field specs do not expose content", () => {
    render(
      <ProjectEditorPostEditorBody
        canEditCurrentPost
        currentPostReadOnlyMessage={null}
        editor={editorMock as never}
        isCurrentPostReadOnly={false}
        mainFieldSpecs={[
          {
            allowedValues: null,
            contentFormat: null,
            editabilityState: "editable",
            fieldKey: "headline",
            label: "Headline",
            multiple: false,
            nullable: false,
            patchMode: "replace",
            readOnly: false,
            relationMode: "none",
            required: true,
            searchMode: "none",
            semanticRole: "title",
            uiControl: "text_input",
            valueKind: "text_like",
            visible: true,
          },
        ]}
        onRetryCurrentPostEditAccess={vi.fn()}
        onTitleChange={vi.fn()}
        onTitleKeyDown={vi.fn()}
        onTitlePaste={vi.fn()}
        selectedPostId="post-1"
        selectedPostTitle="Post"
        titleTextareaRef={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Post title")).toBeInTheDocument();
    expect(screen.queryByTestId("editor-content")).not.toBeInTheDocument();
  });
});
