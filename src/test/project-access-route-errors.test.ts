import { describe, expect, it } from "vitest";

import {
  getProjectAccessRouteErrorMessage,
  getProjectAccessRouteErrorStatus,
} from "@/lib/api/project-access-route-errors";

describe("project access route errors", () => {
  it("maps shared auth and permission failures consistently", () => {
    expect(getProjectAccessRouteErrorStatus("Please sign in to continue.", "authors")).toBe(401);
    expect(getProjectAccessRouteErrorStatus("You do not have permission.", "permissions")).toBe(403);
  });

  it("maps authors route validation and missing-target errors", () => {
    expect(getProjectAccessRouteErrorStatus("Name is required.", "authors")).toBe(400);
    expect(getProjectAccessRouteErrorStatus("Select a content author first.", "authors")).toBe(404);
  });

  it("maps members route validation, conflict, and missing-user errors", () => {
    expect(getProjectAccessRouteErrorStatus("Select at least one role.", "members")).toBe(400);
    expect(getProjectAccessRouteErrorStatus("That user is already a member.", "members")).toBe(409);
    expect(getProjectAccessRouteErrorStatus("That user needs to sign in first.", "members")).toBe(404);
  });

  it("maps permissions route validation and conflict errors", () => {
    expect(getProjectAccessRouteErrorStatus("Invalid permission key.", "permissions")).toBe(400);
    expect(
      getProjectAccessRouteErrorStatus(
        "At least one member must keep permission to manage members.",
        "permissions",
      ),
    ).toBe(409);
  });

  it("falls back to route-specific default messages when the error is not an Error", () => {
    expect(getProjectAccessRouteErrorMessage(null, "authors")).toBe(
      "Could not manage project authors right now.",
    );
    expect(getProjectAccessRouteErrorMessage(undefined, "members")).toBe(
      "Could not manage project members right now.",
    );
    expect(getProjectAccessRouteErrorMessage(false, "permissions")).toBe(
      "Could not manage project permissions right now.",
    );
  });

  it("does not forward raw provider errors through project access routes", () => {
    expect(
      getProjectAccessRouteErrorMessage(
        new Error("password authentication failed for user \"postgres\""),
        "members",
      ),
    ).toBe("The app connection is no longer valid. Update setup and try again.");
  });
});
