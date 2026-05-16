import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ProjectEditorBooleanField,
  ProjectEditorDateTimeField,
  ProjectEditorEnumField,
  ProjectEditorNumberField,
} from "@/components/editor/project-editor/primitive-field-controls";

describe("project editor primitive field controls", () => {
  it("renders the shared number field and reports numeric changes", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorNumberField
        id="reading-time"
        label="Reading Time"
        value={7}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Reading Time/), { target: { value: "12" } });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("renders the shared boolean and enum fields", () => {
    render(
      <div>
        <ProjectEditorBooleanField
          id="featured"
          label="Featured"
          value={true}
          onChange={vi.fn()}
        />
        <ProjectEditorEnumField
          id="status"
          label="Status"
          value="draft"
          options={["draft", "published"]}
          onChange={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByRole("combobox", { name: /Featured/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Status/ })).toBeInTheDocument();
  });

  it("uses an on/off switch for required booleans", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorBooleanField
        id="is-visible"
        label="Visible"
        value={false}
        required
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: /Visible/ }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("renders the shared date-time field with clear support", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorDateTimeField
        id="published-at"
        label="Published On"
        mode="datetime"
        allowClear
        value="2026-04-22T10:30:00.000Z"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Published On/ }));
    expect(screen.getByLabelText("Time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
