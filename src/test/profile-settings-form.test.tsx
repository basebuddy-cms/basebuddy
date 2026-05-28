import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

const { createClientMock, toastSuccessMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => {
    throw new Error("Profile settings must not use Supabase.");
  }),
  toastSuccessMock: vi.fn(),
}));


vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: toastSuccessMock,
  },
}));

describe("profile settings form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("defers avatar media storage and saves name changes through the profile API only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        profile: {
          avatarUrl: "https://cdn.example.com/owner.png",
          email: "owner@example.com",
          name: "Updated Owner",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { ProfileSettingsForm } = await import("@/components/account/profile-settings-form");

    render(
      <ProfileSettingsForm
        initialAvatarUrl="https://cdn.example.com/owner.png"
        initialEmail="owner@example.com"
        initialName="Owner"
        initialUserId="user-1"
      />,
    );

    expect(screen.getByLabelText(/avatar url/i)).toHaveValue("https://cdn.example.com/owner.png");
    expect(screen.queryByRole("button", { name: /upload avatar|change avatar/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: {
        value: "Updated Owner",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/profile", {
        body: JSON.stringify({
          name: "Updated Owner",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      expect(toastSuccessMock).toHaveBeenCalledWith("Profile updated.");
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
