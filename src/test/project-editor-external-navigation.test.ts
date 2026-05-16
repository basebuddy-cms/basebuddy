import { describe, expect, it, vi } from "vitest";

import { requestProjectsNavigation } from "@/components/editor/project-editor/external-navigation";

describe("project editor external navigation", () => {
  it("starts external-page loading before requesting project navigation", async () => {
    const setExternalPageLoading = vi.fn();
    const navigate = vi.fn();
    let capturedAction: (() => void | Promise<void>) | null = null;
    let capturedProceedLabel: string | undefined;
    let capturedOnCancel: (() => void) | undefined;

    const requestUnsavedChangesConfirmation = vi.fn((action, proceedLabel, onCancel) => {
      capturedAction = action;
      capturedProceedLabel = proceedLabel;
      capturedOnCancel = onCancel;
    });

    requestProjectsNavigation({
      navigate,
      requestUnsavedChangesConfirmation,
      setExternalPageLoading,
    });

    expect(setExternalPageLoading).toHaveBeenCalledWith(true);
    expect(capturedProceedLabel).toBe("Discard and Leave");

    await capturedAction?.();

    expect(navigate).toHaveBeenCalledTimes(1);

    capturedOnCancel?.();

    expect(setExternalPageLoading).toHaveBeenLastCalledWith(false);
  });
});
