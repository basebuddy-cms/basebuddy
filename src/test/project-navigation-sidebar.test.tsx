import React from "react";
import { render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/account/account-menu", () => ({
  AccountMenu: ({ name }: { name: string }) => <div>{name}</div>,
}));

import { ProjectNavigationSidebar } from "@/components/editor/project-navigation-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

describe("ProjectNavigationSidebar", () => {
  it("renders a minimal loading mark while a collection count is still loading", () => {
    render(
      <SidebarProvider>
        <ProjectNavigationSidebar
          accountAvatarUrl={null}
          accountEmail="owner@example.com"
          accountName="Owner"
          isSettingsView={false}
          onOpenSettings={vi.fn()}
          settingsHref="/projects/demo/settings"
          sidebarCollectionItems={[
            {
              count: null,
              href: "/projects/demo/posts",
              icon: FileText,
              isActive: true,
              label: "Posts",
              onSelect: vi.fn(),
              status: "ready",
            },
          ]}
          settingsItems={[]}
        />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: "Posts" })).toBeInTheDocument();
    expect(screen.queryByText("Updating")).not.toBeInTheDocument();
    expect(screen.getByTestId("collection-count-skeleton")).toBeInTheDocument();
  });

  it("renders approximate collection counts without extra copy", () => {
    render(
      <SidebarProvider>
        <ProjectNavigationSidebar
          accountAvatarUrl={null}
          accountEmail="owner@example.com"
          accountName="Owner"
          isSettingsView={false}
          onOpenSettings={vi.fn()}
          settingsHref="/projects/demo/settings"
          sidebarCollectionItems={[
            {
              count: 500_000,
              countIsExact: false,
              href: "/projects/demo/posts",
              icon: FileText,
              isActive: true,
              label: "Posts",
              onSelect: vi.fn(),
              status: "ready",
            },
          ]}
          settingsItems={[]}
        />
      </SidebarProvider>,
    );

    expect(screen.queryByText("About 500K")).not.toBeInTheDocument();
    expect(screen.getByText("500K")).toBeInTheDocument();
  });

  it("renders small approximate collection counts as plain counts", () => {
    render(
      <SidebarProvider>
        <ProjectNavigationSidebar
          accountAvatarUrl={null}
          accountEmail="owner@example.com"
          accountName="Owner"
          isSettingsView={false}
          onOpenSettings={vi.fn()}
          settingsHref="/projects/demo/settings"
          sidebarCollectionItems={[
            {
              count: 3,
              countIsExact: false,
              href: "/projects/demo/posts",
              icon: FileText,
              isActive: true,
              label: "Posts",
              onSelect: vi.fn(),
              status: "ready",
            },
          ]}
          settingsItems={[]}
        />
      </SidebarProvider>,
    );

    expect(screen.queryByText("About 3")).not.toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not render negative approximate collection counts", () => {
    render(
      <SidebarProvider>
        <ProjectNavigationSidebar
          accountAvatarUrl={null}
          accountEmail="owner@example.com"
          accountName="Owner"
          isSettingsView={false}
          onOpenSettings={vi.fn()}
          settingsHref="/projects/demo/settings"
          sidebarCollectionItems={[
            {
              count: -1,
              countIsExact: false,
              href: "/projects/demo/categories",
              icon: FileText,
              isActive: true,
              label: "Categories",
              onSelect: vi.fn(),
              status: "ready",
            },
          ]}
          settingsItems={[]}
        />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: "Categories" })).toBeInTheDocument();
    expect(screen.queryByText("About -1")).not.toBeInTheDocument();
    expect(screen.queryByText("Updating")).not.toBeInTheDocument();
    expect(screen.getByTestId("collection-count-skeleton")).toBeInTheDocument();
  });

  it("shows unmapped collections as setup entries while keeping them clickable", () => {
    render(
      <SidebarProvider>
        <ProjectNavigationSidebar
          accountAvatarUrl={null}
          accountEmail="owner@example.com"
          accountName="Owner"
          isSettingsView={false}
          onOpenSettings={vi.fn()}
          settingsHref="/projects/demo/settings"
          sidebarCollectionItems={[
            {
              count: 0,
              href: "/projects/demo/categories",
              icon: FileText,
              isActive: false,
              label: "Categories",
              onSelect: vi.fn(),
              status: "unmapped",
            },
          ]}
          settingsItems={[]}
        />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: "Categories" })).toBeInTheDocument();
    expect(screen.getByText("Set up")).toBeInTheDocument();
  });
});
