import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorPostsMappingCustomFieldsStep } from "@/components/editor/project-editor/posts-mapping-wizard";
import type { PostsMappingCustomField } from "@/components/editor/project-editor/types";

const createCustomField = (
  overrides: Partial<PostsMappingCustomField> = {},
): PostsMappingCustomField => ({
  allowedValues: null,
  arrayIndex: null,
  column: "metadata",
  dataType: "jsonb",
  defaultValue: null,
  enabled: true,
  fieldKey: "metadata",
  isNullable: true,
  kind: "json",
  label: "Metadata",
  path: null,
  sampleValues: [],
  sourceIsArray: false,
  sourceIsExotic: false,
  sourceIsJson: true,
  ...overrides,
});

describe("ProjectEditorPostsMappingCustomFieldsStep", () => {
  it("renders non-direct custom field controls and reports path, kind, and array item updates", () => {
    const onToggleField = vi.fn();
    const onUpdateFieldArrayIndex = vi.fn();
    const onUpdateFieldKind = vi.fn();
    const onUpdateFieldPath = vi.fn();

    render(
      <ProjectEditorPostsMappingCustomFieldsStep
        customFields={[
          createCustomField(),
          createCustomField({
            arrayIndex: 1,
            column: "aliases",
            dataType: "text[]",
            fieldKey: "secondary_alias",
            kind: "text",
            label: "Aliases",
            path: null,
            sourceIsArray: true,
            sourceIsJson: false,
          }),
        ]}
        onToggleField={onToggleField}
        onUpdateFieldArrayIndex={onUpdateFieldArrayIndex}
        onUpdateFieldKind={onUpdateFieldKind}
        onUpdateFieldPath={onUpdateFieldPath}
      />,
    );

    fireEvent.change(screen.getByLabelText("Metadata JSON path"), {
      target: { value: "card.title" },
    });

    expect(onUpdateFieldPath).toHaveBeenCalledWith("metadata", "card.title");
    expect(onUpdateFieldKind).toHaveBeenCalledWith("metadata", "text");

    fireEvent.change(screen.getByLabelText("Aliases field type"), {
      target: { value: "number" },
    });

    expect(onUpdateFieldKind).toHaveBeenCalledWith("aliases", "number");

    fireEvent.change(screen.getByLabelText("Aliases item number"), {
      target: { value: "3" },
    });

    expect(onUpdateFieldArrayIndex).toHaveBeenCalledWith("aliases", "3");

    fireEvent.click(screen.getAllByRole("switch")[0] as HTMLElement);

    expect(onToggleField).toHaveBeenCalledWith("metadata", false);
  });

  it("defaults JSON and array custom fields back to structured kinds when non-direct selectors are cleared", () => {
    const onToggleField = vi.fn();
    const onUpdateFieldArrayIndex = vi.fn();
    const onUpdateFieldKind = vi.fn();
    const onUpdateFieldPath = vi.fn();

    render(
      <ProjectEditorPostsMappingCustomFieldsStep
        customFields={[
          createCustomField({
            fieldKey: "card_title",
            kind: "text",
            path: "card.title",
          }),
          createCustomField({
            arrayIndex: 2,
            column: "aliases",
            dataType: "text[]",
            fieldKey: "secondary_alias",
            kind: "text",
            label: "Aliases",
            sourceIsArray: true,
            sourceIsJson: false,
          }),
        ]}
        onToggleField={onToggleField}
        onUpdateFieldArrayIndex={onUpdateFieldArrayIndex}
        onUpdateFieldKind={onUpdateFieldKind}
        onUpdateFieldPath={onUpdateFieldPath}
      />,
    );

    fireEvent.change(screen.getByLabelText("Metadata JSON path"), {
      target: { value: "" },
    });

    expect(onUpdateFieldPath).toHaveBeenCalledWith("metadata", "");
    expect(onUpdateFieldKind).toHaveBeenCalledWith("metadata", "json");

    fireEvent.change(screen.getByLabelText("Aliases item number"), {
      target: { value: "" },
    });

    expect(onUpdateFieldArrayIndex).toHaveBeenCalledWith("aliases", null);
    expect(onUpdateFieldKind).toHaveBeenCalledWith("aliases", "array");
  });

  it("shows an unsupported-source note for exotic custom field types", () => {
    render(
      <ProjectEditorPostsMappingCustomFieldsStep
        customFields={[
          createCustomField({
            column: "raw_blob",
            dataType: "bytea",
            fieldKey: "raw_blob",
            kind: "text",
            label: "Raw Blob",
            sourceIsExotic: true,
            sourceIsJson: false,
          }),
        ]}
        onToggleField={vi.fn()}
        onUpdateFieldArrayIndex={vi.fn()}
        onUpdateFieldKind={vi.fn()}
        onUpdateFieldPath={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "This source type will stay read-only in BaseBuddy until this field type is supported.",
      ),
    ).toBeInTheDocument();
  });
});
