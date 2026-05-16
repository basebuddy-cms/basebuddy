import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectPermissionsSettings } from "@/components/editor/project-permissions-settings";
import { DEFAULT_PROJECT_PERMISSION_DEFINITIONS } from "@/lib/control-plane/member-permissions";

globalThis.React = React;

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const createPermissionsPayload = () => ({
  currentUserId: "admin-user",
  members: [
    {
      allowPermissionKeys: [],
      avatarUrl: null,
      denyPermissionKeys: [],
      effectivePermissionKeys: [
        "project.read",
        "project.update",
        "member.manage",
        "content.read.all",
      ],
      email: "admin@example.com",
      inheritedPermissionKeys: [
        "project.read",
        "project.update",
        "member.manage",
        "content.read.all",
      ],
      joinedAt: "2026-05-01T00:00:00.000Z",
      name: "Admin User",
      roles: ["admin"],
      userId: "admin-user",
    },
    {
      allowPermissionKeys: [],
      avatarUrl: null,
      denyPermissionKeys: [],
      effectivePermissionKeys: [
        "project.read",
        "project.update",
        "project.delete",
        "member.manage",
      ],
      email: "owner@example.com",
      inheritedPermissionKeys: [
        "project.read",
        "project.update",
        "project.delete",
        "member.manage",
      ],
      joinedAt: "2026-05-01T00:00:00.000Z",
      name: "Owner User",
      roles: ["owner"],
      userId: "owner-user",
    },
  ],
  permissions: DEFAULT_PROJECT_PERMISSION_DEFINITIONS,
});

describe("ProjectPermissionsSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(createPermissionsPayload())),
    );
  });

  it("prevents admins from changing owner members or delete permission overrides", async () => {
    render(<ProjectPermissionsSettings projectId="project-1" />);

    await screen.findByRole("heading", { name: "Admin User" });

    const deleteProjectSwitch = screen.getByRole("switch", {
      name: "Delete project permission",
    });
    expect(deleteProjectSwitch).toBeDisabled();
    expect(
      screen.getByText("Only project owners can change delete access."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Owner User/ }));

    await screen.findByRole("heading", { name: "Owner User" });
    expect(
      screen.getAllByText("Only project owners can change owner permissions.").length,
    ).toBeGreaterThan(0);

    const ownerSwitches = screen.getAllByRole("switch");
    expect(ownerSwitches.length).toBeGreaterThan(0);
    expect(ownerSwitches.every((control) => control.hasAttribute("disabled"))).toBe(true);
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
  });
});
