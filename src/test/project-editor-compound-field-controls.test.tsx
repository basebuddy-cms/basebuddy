import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ProjectEditorRedirectRowsField,
  ProjectEditorStructuredField,
  ProjectEditorTokenListField,
} from "@/components/editor/project-editor/compound-field-controls";
import { createContentRedirectEntry } from "@/lib/content-runtime/shared";

describe("project editor compound field controls", () => {
  it("adds and removes items in the shared token list field", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorTokenListField
        id="keywords"
        label="Keywords"
        onChange={onChange}
        values={["cms"]}
      />,
    );

    const input = screen.getByLabelText(/Keywords/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "postgres" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["cms", "postgres"]);

    fireEvent.click(screen.getByRole("button", { name: /Remove cms/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("parses valid json and preserves invalid raw text in the shared json editor", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorStructuredField
        id="meta"
        label="Meta"
        onChange={onChange}
        value={{ title: "Hello" }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Meta/), {
      target: { value: "{\"draft\":true}" },
    });
    expect(onChange).toHaveBeenCalledWith({ draft: true });

    fireEvent.change(screen.getByLabelText(/Meta/), {
      target: { value: "{draft" },
    });
    expect(onChange).toHaveBeenLastCalledWith("{draft");
  });

  it("preserves raw xml text in the shared structured editor", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorStructuredField
        format="xml"
        id="rss"
        label="RSS"
        onChange={onChange}
        value="<rss />"
      />,
    );

    fireEvent.change(screen.getByLabelText(/RSS/), {
      target: { value: "<rss><item /></rss>" },
    });

    expect(onChange).toHaveBeenCalledWith("<rss><item /></rss>");
  });

  it("handles row creation and source edits in the structured redirects field", () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ProjectEditorRedirectRowsField
        id="redirects"
        label="Redirects"
        onChange={onChange}
        values={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add redirect/i }));
    expect(onChange).toHaveBeenCalledWith([createContentRedirectEntry({ source: "" })]);

    onChange.mockClear();

    rerender(
      <ProjectEditorRedirectRowsField
        id="redirects-filled"
        label="Redirects"
        onChange={onChange}
        values={[createContentRedirectEntry({ source: "/old-path" })]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Redirect Source/i), {
      target: { value: "/older-path" },
    });
    expect(onChange).toHaveBeenCalledWith([createContentRedirectEntry({ source: "/older-path" })]);
  });
});
