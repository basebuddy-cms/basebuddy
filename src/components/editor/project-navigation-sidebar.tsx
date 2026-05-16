"use client";

import React from "react";
import { Settings, type LucideIcon } from "lucide-react";

import { AccountMenu } from "@/components/account/account-menu";
import { NavigationLink } from "@/components/editor/navigation-link";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export type ProjectNavigationSidebarCollectionItem = {
  count: number | null;
  countIsExact?: boolean;
  href: string;
  icon: LucideIcon;
  isActive: boolean;
  label: string;
  onSelect: () => void;
  status: "ready" | "unmapped";
};

export type ProjectNavigationSidebarSettingsItem = {
  href: string;
  isActive: boolean;
  label: string;
  onSelect: () => void;
};

type ProjectNavigationSidebarProps = {
  accountAvatarUrl: string | null;
  accountEmail: string | null;
  accountName: string;
  isSettingsView: boolean;
  onOpenSettings: () => void;
  settingsHref: string;
  sidebarCollectionItems: ProjectNavigationSidebarCollectionItem[];
  settingsItems: ProjectNavigationSidebarSettingsItem[];
};

const formatCompactCount = (count: number) => {
  if (count >= 1_000_000) {
    const compact = Math.round(count / 100_000) / 10;
    return `${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)}M`;
  }

  if (count >= 1_000) {
    const compact = Math.round(count / 100) / 10;
    return `${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)}K`;
  }

  return String(count);
};

const getCollectionCountBadgeText = (item: ProjectNavigationSidebarCollectionItem) => {
  if (item.status === "unmapped") {
    return "Set up";
  }

  if (item.count === null || !Number.isFinite(item.count) || item.count < 0) {
    return null;
  }

  return formatCompactCount(item.count);
};

export function ProjectNavigationSidebar({
  accountAvatarUrl,
  accountEmail,
  accountName,
  isSettingsView,
  onOpenSettings,
  settingsHref,
  sidebarCollectionItems,
  settingsItems,
}: ProjectNavigationSidebarProps) {
  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card text-foreground">
      <SidebarContent className="px-2 py-2 pt-14 group-data-[collapsible=icon]:px-1">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {sidebarCollectionItems.map((item) => (
                <SidebarMenuItem key={item.label} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                  <SidebarMenuButton
                    asChild
                    isActive={item.isActive}
                    tooltip={item.label}
                    className={cn(
                      "h-9 rounded-md px-2.5 text-[13px] font-medium group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:!px-0",
                      item.status === "unmapped"
                        ? "text-muted-foreground/75 hover:bg-accent/70 hover:text-foreground/90 data-[active=true]:bg-accent/60 data-[active=true]:text-foreground/90"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground",
                    )}
                  >
                    <NavigationLink href={item.href} onPlainNavigation={item.onSelect}>
                      <item.icon className="size-3.5" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </NavigationLink>
                  </SidebarMenuButton>
                  <SidebarMenuBadge
                    className={cn(
                      "right-2 top-2 text-[10px]",
                      item.status === "unmapped"
                        ? "font-semibold uppercase tracking-[0.08em] text-muted-foreground/80"
                      : "text-muted-foreground",
                    )}
                  >
                    {getCollectionCountBadgeText(item) ?? (
                      <span
                        aria-hidden="true"
                        data-testid="collection-count-skeleton"
                        className="h-1.5 w-3 rounded-full bg-foreground/30"
                      />
                    )}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <SidebarMenuButton
                  asChild
                  isActive={isSettingsView}
                  tooltip="Project Settings"
                  className="h-9 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:!px-0"
                >
                  <NavigationLink href={settingsHref} onPlainNavigation={() => onOpenSettings()}>
                    <Settings className="size-3.5" />
                    <span className="group-data-[collapsible=icon]:hidden">Project Settings</span>
                  </NavigationLink>
                </SidebarMenuButton>
                {isSettingsView && settingsItems.length ? (
                  <div className="mt-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                    <div className="ml-4 border-l border-border/80 pl-2">
                      {settingsItems.map((item) => (
                        <NavigationLink
                          key={item.label}
                          href={item.href}
                          className={[
                            "flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] font-medium transition-colors",
                            item.isActive
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                          ].join(" ")}
                          onPlainNavigation={item.onSelect}
                        >
                          {item.label}
                        </NavigationLink>
                      ))}
                    </div>
                  </div>
                ) : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-2 py-2 group-data-[collapsible=icon]:px-1">
        <AccountMenu
          avatarUrl={accountAvatarUrl}
          email={accountEmail}
          name={accountName}
          variant="sidebar"
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
