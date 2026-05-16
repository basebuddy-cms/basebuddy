import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useProjectEditorDebouncedValue } from "@/components/editor/project-editor/use-debounced-value";

function DebouncedValueProbe({
  delayMs,
  value,
}: {
  delayMs: number;
  value: string;
}) {
  const debouncedValue = useProjectEditorDebouncedValue(value, delayMs);

  return <p data-testid="debounced-value">{debouncedValue}</p>;
}

describe("useProjectEditorDebouncedValue", () => {
  it("keeps the previous value until the debounce delay finishes", () => {
    vi.useFakeTimers();

    try {
      const { rerender } = render(<DebouncedValueProbe delayMs={300} value="a" />);

      expect(screen.getByText("a")).toBeInTheDocument();

      rerender(<DebouncedValueProbe delayMs={300} value="ab" />);

      expect(screen.getByText("a")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(299);
      });

      expect(screen.getByText("a")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByText("ab")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("coalesces rapid relation search changes to the latest value", () => {
    vi.useFakeTimers();

    try {
      const { rerender } = render(<DebouncedValueProbe delayMs={300} value="" />);

      rerender(<DebouncedValueProbe delayMs={300} value="m" />);
      rerender(<DebouncedValueProbe delayMs={300} value="me" />);
      rerender(<DebouncedValueProbe delayMs={300} value="met" />);

      expect(screen.getByTestId("debounced-value")).toHaveTextContent("");

      act(() => {
        vi.advanceTimersByTime(299);
      });

      expect(screen.getByTestId("debounced-value")).toHaveTextContent("");

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByText("met")).toBeInTheDocument();
      expect(screen.queryByText("m")).not.toBeInTheDocument();
      expect(screen.queryByText("me")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
