import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectEditorPostsMappingWizard } from "@/components/editor/project-editor/posts-mapping-wizard";

describe("posts mapping wizard transition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances through contextual mapping save messages while saving", () => {
    render(
      <ProjectEditorPostsMappingWizard
        currentProjectName="Demo Project"
        currentStepDescription="Map posts to your database."
        currentStepTitle="Posts"
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        postsMappingStepIndex={0}
        savingMessages={[
          {
            detail: "Saving the connected post mapping.",
            title: "Saving content mapping",
          },
          {
            detail: "Reloading the editor with the saved mapping.",
            title: "Refreshing editor",
          },
        ]}
        savingPostsMapping
      />,
    );

    expect(screen.getByRole("heading", { name: "Saving content mapping" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4_999);
    });

    expect(screen.getByRole("heading", { name: "Saving content mapping" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByRole("heading", { name: "Refreshing editor" })).toBeInTheDocument();
  });

  it("renders status actions alongside the status message", () => {
    render(
      <ProjectEditorPostsMappingWizard
        currentProjectName="Demo Project"
        currentStepDescription="Map posts to your database."
        currentStepTitle="Posts"
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        postsMappingStepIndex={0}
        savingPostsMapping={false}
        statusMessage="Auto-detection is taking longer than expected."
        statusChildren={<button type="button">Choose table manually</button>}
      />,
    );

    expect(screen.getByText("Auto-detection is taking longer than expected.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose table manually" })).toBeInTheDocument();
  });
});
