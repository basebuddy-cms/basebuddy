import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditorImageSettingsPanel } from "@/components/editor/project-editor/editor-image-settings-panel";

describe("ProjectEditorImageSettingsPanel", () => {
  it("lets editors change selected image alt text and dimensions", () => {
    const onChange = vi.fn();

    render(
      <ProjectEditorImageSettingsPanel
        image={{
          align: "center",
          alt: "Hero",
          height: "480",
          linkHref: "https://example.com",
          src: "https://assets.test/hero.png",
          width: "720",
        }}
        onChange={onChange}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Alt text"), {
      target: { value: "Launch hero" },
    });
    fireEvent.change(screen.getByLabelText("Width"), {
      target: { value: "960" },
    });
    fireEvent.change(screen.getByLabelText("Height"), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenCalledWith({ alt: "Launch hero" });
    expect(onChange).toHaveBeenCalledWith({ width: "960" });
    expect(onChange).toHaveBeenCalledWith({ height: null });
  });

  it("lets editors align, link, and remove the selected image", () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <ProjectEditorImageSettingsPanel
        image={{
          align: "left",
          alt: "",
          height: "",
          linkHref: "",
          src: "https://assets.test/hero.png",
          width: "",
        }}
        onChange={onChange}
        onClose={vi.fn()}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Align center" }));
    fireEvent.change(screen.getByLabelText("Image link"), {
      target: { value: "https://example.com/full" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));

    expect(onChange).toHaveBeenCalledWith({ align: "center" });
    expect(onChange).toHaveBeenCalledWith({ linkHref: "https://example.com/full" });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
