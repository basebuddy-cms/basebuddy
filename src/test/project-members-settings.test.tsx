import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectMembersSettings } from "@/components/editor/project-members-settings";

globalThis.React = React;

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const createMembersPayload = () => ({
  availableAuthors: [],
  availableRoles: [
    {
      description: "Manage the project, members, settings, and content except delete.",
      label: "Admin",
      priority: 400,
      roleKey: "admin",
    },
    {
      description: "Read, edit, and publish content across the whole project.",
      label: "Editor",
      priority: 300,
      roleKey: "editor",
    },
    {
      description: "Read, edit, and publish only assigned author content.",
      label: "Author",
      priority: 200,
      roleKey: "author",
    },
    {
      description: "Read-only access to project content.",
      label: "Viewer",
      priority: 100,
      roleKey: "viewer",
    },
  ],
  capabilities: {
    canInviteMembers: true,
    canManageMembers: true,
  },
  currentUserId: "admin-user",
  members: [
    {
      authorScopes: [],
      avatarUrl: null,
      email: "owner@example.com",
      joinedAt: "2026-05-01T00:00:00.000Z",
      name: "Owner User",
      roles: ["owner"],
      userId: "owner-user",
    },
    {
      authorScopes: [],
      avatarUrl: null,
      email: "admin@example.com",
      joinedAt: "2026-05-01T00:00:00.000Z",
      name: "Admin User",
      roles: ["admin"],
      userId: "admin-user",
    },
  ],
});

describe("ProjectMembersSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(createMembersPayload())),
    );
  });

  it("prevents admins from changing owner member access", async () => {
    render(<ProjectMembersSettings projectId="project-1" />);

    await screen.findByText("Owner User");

    fireEvent.click(screen.getAllByRole("button", { name: /Manage access/ })[0]);

    expect(screen.getByText("Only project owners can change owner members.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save access" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Remove" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "Admin" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editor" })).toBeDisabled();
  });
});
