import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectEditorFieldStateNotice } from "@/components/editor/project-editor/field-state-notice";

describe("ProjectEditorFieldStateNotice", () => {
  it("renders a compact field state with helper text and current value", () => {
    render(
      <ProjectEditorFieldStateNotice
        currentValue="Current value: Example"
        helperText="This field is read-only in BaseBuddy."
        label="Excerpt"
      />,
    );

    expect(screen.getByText("Excerpt")).toBeInTheDocument();
    expect(screen.getByText("This field is read-only in BaseBuddy.")).toBeInTheDocument();
    expect(screen.getByText("Current value: Example")).toBeInTheDocument();
  });
});
