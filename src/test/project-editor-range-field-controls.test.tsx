import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ProjectEditorMultirangeField,
  ProjectEditorRangeField,
} from "@/components/editor/project-editor/range-field-controls";

describe("project editor range field controls", () => {
  it("reports literal range edits through the shared range input", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorRangeField
        id="availability-window"
        label="Availability Window"
        onChange={onChange}
        value="[2026-01-01,2026-12-31)"
      />,
    );

    fireEvent.change(screen.getByLabelText(/Availability Window/), {
      target: { value: "[2026-02-01,2026-11-30)" },
    });

    expect(onChange).toHaveBeenCalledWith("[2026-02-01,2026-11-30)");
  });

  it("reports literal multirange edits through the shared multirange editor", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorMultirangeField
        id="season-windows"
        label="Season Windows"
        onChange={onChange}
        value='{"[2026-01-01,2026-03-31)"}'
      />,
    );

    fireEvent.change(screen.getByLabelText(/Season Windows/), {
      target: { value: '{"[2026-01-01,2026-03-31)","[2026-07-01,2026-09-30)"}' },
    });

    expect(onChange).toHaveBeenCalledWith(
      '{"[2026-01-01,2026-03-31)","[2026-07-01,2026-09-30)"}',
    );
  });
});
