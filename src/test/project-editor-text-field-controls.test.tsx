import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ProjectEditorTextInputField,
  ProjectEditorTextareaField,
  ProjectEditorTitleTextareaField,
} from "@/components/editor/project-editor/text-field-controls";

describe("project editor text field controls", () => {
  it("renders shared text and textarea controls with helper copy and required markers", () => {
    const onInputChange = vi.fn();
    const onTextareaChange = vi.fn();

    render(
      <div>
        <ProjectEditorTextInputField
          id="seo-title"
          label="Meta Title"
          required
          value="Hello"
          helperText="Defaults to post title if blank."
          onChange={onInputChange}
        />
        <ProjectEditorTextareaField
          id="excerpt"
          label="Excerpt"
          value="Summary"
          footer={<div>Character count</div>}
          onChange={onTextareaChange}
        />
      </div>,
    );

    expect(screen.getByLabelText(/Meta Title/)).toHaveValue("Hello");
    expect(screen.getByText("Defaults to post title if blank.")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByLabelText("Excerpt")).toHaveValue("Summary");
    expect(screen.getByText("Character count")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Meta Title/), { target: { value: "Updated" } });
    fireEvent.change(screen.getByLabelText("Excerpt"), { target: { value: "Updated summary" } });

    expect(onInputChange).toHaveBeenCalled();
    expect(onTextareaChange).toHaveBeenCalled();
  });

  it("renders the shared title textarea control", () => {
    render(
      <ProjectEditorTitleTextareaField
        id="post-1"
        textareaRef={vi.fn()}
        value="Post"
        onChange={vi.fn()}
        onKeyDown={vi.fn()}
        onPaste={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Post title")).toHaveValue("Post");
  });
});
