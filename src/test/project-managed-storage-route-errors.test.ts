import { describe, expect, it } from "vitest";

import {
  getManagedStorageRouteErrorMessage,
  getManagedStorageRouteErrorStatus,
} from "@/lib/api/project-managed-storage-route-errors";

describe("project managed storage route errors", () => {
  it("maps common auth and permission failures consistently", () => {
    expect(getManagedStorageRouteErrorStatus("Please sign in to continue.", "media")).toBe(401);
    expect(getManagedStorageRouteErrorStatus("You do not have permission.", "files")).toBe(403);
  });

  it("maps media-specific validation and missing-resource failures", () => {
    expect(getManagedStorageRouteErrorStatus("Choose an image first.", "media")).toBe(400);
    expect(getManagedStorageRouteErrorStatus("Could not find that folder.", "media")).toBe(404);
  });

  it("maps files-specific validation and missing-resource failures", () => {
    expect(getManagedStorageRouteErrorStatus("Image files belong in the media library.", "files")).toBe(400);
    expect(getManagedStorageRouteErrorStatus("Could not find that file.", "files")).toBe(404);
  });

  it("maps degraded database failures to a retryable status", () => {
    expect(
      getManagedStorageRouteErrorStatus(
        "BaseBuddy is having trouble reaching this project's content right now. Try again in a few seconds.",
        "files",
      ),
    ).toBe(503);
  });

  it("falls back to the route-specific default message when the error is not an Error", () => {
    expect(getManagedStorageRouteErrorMessage(null, "media")).toBe(
      "Could not manage the media library right now.",
    );
    expect(getManagedStorageRouteErrorMessage(undefined, "files")).toBe(
      "Could not manage the files library right now.",
    );
  });

  it("sanitizes raw storage-provider messages before returning them to the UI", () => {
    expect(
      getManagedStorageRouteErrorMessage(
        new Error("SignatureDoesNotMatch"),
        "files",
      ),
    ).toBe("We couldn't complete the storage request. Check upload storage and try again.");
  });
});
