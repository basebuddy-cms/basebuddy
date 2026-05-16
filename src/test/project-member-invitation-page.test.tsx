import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

const {
  getOptionalAuthenticatedUserWithAccountMock,
  getProjectMemberInvitationPreviewMock,
  refreshMock,
  replaceMock,
} = vi.hoisted(() => ({
  getOptionalAuthenticatedUserWithAccountMock: vi.fn(),
  getProjectMemberInvitationPreviewMock: vi.fn(),
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    replace: replaceMock,
  }),
}));

vi.mock("@/lib/control-plane/server", () => ({
  getOptionalAuthenticatedUserWithAccount: getOptionalAuthenticatedUserWithAccountMock,
}));

vi.mock("@/lib/control-plane/member-invitations-server", () => ({
  getProjectMemberInvitationPreview: getProjectMemberInvitationPreviewMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

describe("project invitation page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getOptionalAuthenticatedUserWithAccountMock.mockResolvedValue({
      account: null,
      user: null,
    });
    getProjectMemberInvitationPreviewMock.mockResolvedValue({
      acceptedAt: null,
      authorScopes: [],
      expiresAt: "2026-04-03T10:00:00.000Z",
      invitePath: "/invite/invite-token-123",
      invitedEmail: "writer@example.com",
      projectId: "project-1",
      projectName: "Demo Project",
      projectSlug: "demo-project",
      revokedAt: null,
      roles: ["author"],
      status: "pending",
    });
  });

  it("shows the sign-in handoff when the invite exists and the visitor is signed out", async () => {
    const ProjectInvitationPage = (await import("@/app/invite/[publicToken]/page")).default;

    render(
      await ProjectInvitationPage({
        params: Promise.resolve({ publicToken: "invite-token-123" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Join Demo Project" })).toBeInTheDocument();
    expect(
      screen.getByText("Treat this invite link like a key to this project. Only share it with the invited person."),
    ).toBeInTheDocument();
    expect(screen.getByText("Sign in or create your account first")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in with invited email" })).toHaveAttribute(
      "href",
      "/login?email=writer%40example.com&next=%2Finvite%2Finvite-token-123",
    );
  });
});
