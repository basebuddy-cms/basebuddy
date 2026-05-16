"use client";

import React, { type Dispatch, type SetStateAction } from "react";
import { Check, Database, Lock, LockOpen } from "lucide-react";

import {
  ProjectMemberInvitationsSettings,
  ProjectMembersSettings,
} from "@/components/editor/project-members-settings";
import { ProjectPermissionsSettings } from "@/components/editor/project-permissions-settings";
import { ProjectEditorPostSidebarSettings } from "@/components/editor/project-editor/post-sidebar-settings";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { normalizeProjectSlug } from "@/lib/control-plane/utils";
import type {
  ContentPostSidebarConfig,
  ContentWorkspaceMeta,
} from "@/lib/content-runtime/shared";

import {
  getProjectEditorCollectionAvailability,
  getSettingsTabLabel,
} from "./utils";
import type {
  CollectionLabel,
  SettingsTabKey,
} from "./types";
import { getProjectEditorCollectionSetupCopy } from "./utils";

type MappingSettingsUnmapTarget = CollectionLabel | "all";

type ProjectSettingsViewProps = {
  activeSettingsTab: SettingsTabKey;
  canDeleteProject: boolean;
  canUpdateProject: boolean;
  handleOpenSettingsMapping: (collection: CollectionLabel) => Promise<void> | void;
  handlePostSidebarConfigResetToDefault: () => void;
  handlePostSidebarConfigRestoreSaved: () => void;
  handlePostSidebarConfigSave: () => Promise<void> | void;
  handleUnmapSettingsMapping: (target: MappingSettingsUnmapTarget) => Promise<void> | void;
  handleProjectSlugUnlock: () => void;
  handleProjectSettingsSave: () => Promise<void> | void;
  hasPostSidebarConfigChanges: boolean;
  hasProjectSettingsChanges: boolean;
  contentRuntime: ContentWorkspaceMeta["contentRuntime"];
  isDeletingProject: boolean;
  isProjectSlugLocked: boolean;
  isSavingPostSidebarConfig: boolean;
  isSavingProjectSettings: boolean;
  loadingSettingsMappingCollection: CollectionLabel | null;
  nextProjectUrl: string;
  normalizedSettingsSlug: string;
  postSidebarConfigDraft: ContentPostSidebarConfig;
  projectId: string;
  setPostSidebarConfigDraft: Dispatch<SetStateAction<ContentPostSidebarConfig>>;
  setIsProjectSlugLocked: Dispatch<SetStateAction<boolean>>;
  setSettingsNameDraft: Dispatch<SetStateAction<string>>;
  setSettingsSlugDraft: Dispatch<SetStateAction<string>>;
  setSettingsWebsiteUrlDraft: Dispatch<SetStateAction<string>>;
  setShowDeleteProjectDialog: Dispatch<SetStateAction<boolean>>;
  settingsMappingError: string | null;
  settingsNameDraft: string;
  settingsSlugDraft: string;
  settingsWebsiteUrlDraft: string;
  supportsPostRevisions: boolean;
  unmappingSettingsTarget: MappingSettingsUnmapTarget | null;
  workspaceState?: "mapping_draft" | "ready" | null;
};

export function ProjectSettingsView({
  activeSettingsTab,
  canDeleteProject,
  canUpdateProject,
  handleOpenSettingsMapping,
  handlePostSidebarConfigResetToDefault,
  handlePostSidebarConfigRestoreSaved,
  handlePostSidebarConfigSave,
  handleUnmapSettingsMapping,
  handleProjectSlugUnlock,
  handleProjectSettingsSave,
  hasPostSidebarConfigChanges,
  hasProjectSettingsChanges,
  contentRuntime,
  isDeletingProject,
  isProjectSlugLocked,
  isSavingPostSidebarConfig,
  isSavingProjectSettings,
  loadingSettingsMappingCollection,
  nextProjectUrl,
  normalizedSettingsSlug,
  postSidebarConfigDraft,
  projectId,
  setPostSidebarConfigDraft,
  setIsProjectSlugLocked,
  setSettingsNameDraft,
  setSettingsSlugDraft,
  setSettingsWebsiteUrlDraft,
  setShowDeleteProjectDialog,
  settingsMappingError,
  settingsNameDraft,
  settingsSlugDraft,
  settingsWebsiteUrlDraft,
  supportsPostRevisions,
  unmappingSettingsTarget,
  workspaceState = null,
}: ProjectSettingsViewProps) {
  const [pendingUnmapTarget, setPendingUnmapTarget] = React.useState<MappingSettingsUnmapTarget | null>(null);
  const mappingSections: Array<{
    collection: CollectionLabel;
    description: string;
    title: string;
  }> = [
    {
      collection: "Posts",
      description: "Choose the main posts source and connect core fields, workflow, SEO, and editor content.",
      title: "Posts mapping",
    },
    {
      collection: "Authors",
      description:
        "Connect author records and assignment fields so BaseBuddy can show authors and support author-scoped access.",
      title: "Authors mapping",
    },
    {
      collection: "Categories",
      description: "Connect category sources so posts can be organized into categories in BaseBuddy.",
      title: "Categories mapping",
    },
    {
      collection: "Tags",
      description: "Connect tag sources so posts can be labeled and filtered with tags in BaseBuddy.",
      title: "Tags mapping",
    },
    {
      collection: "Media",
      description: "Choose where images and uploads are stored for the media library.",
      title: "Media mapping",
    },
    {
      collection: "Files",
      description: "Choose where downloadable assets are stored for the files library.",
      title: "Files mapping",
    },
  ];
  const isSettingsMappingBusy =
    loadingSettingsMappingCollection !== null || unmappingSettingsTarget !== null;
  const isCollectionMapped = (collection: CollectionLabel) => {
    if (collection === "Posts") {
      return workspaceState === "ready";
    }

    return (
      getProjectEditorCollectionAvailability({
        canManageAuthorDirectory: true,
        collection,
        contentRuntime,
        isContentProject: true,
        workspaceState,
      }) === "ready"
    );
  };
  const hasMappedSection = mappingSections.some((section) => isCollectionMapped(section.collection));
  const mappedSectionCount = mappingSections.filter((section) => isCollectionMapped(section.collection)).length;
  const pendingUnmapHeading =
    pendingUnmapTarget === "all"
      ? "Remove all content mapping?"
      : `Remove ${pendingUnmapTarget ?? "content"} mapping?`;
  const pendingUnmapDescription =
    pendingUnmapTarget === "Posts"
      ? "Posts will stop loading in the editor until they are set up again. Authors, categories, and tags will also be disconnected because they depend on posts."
      : pendingUnmapTarget === "all"
        ? "Content, media, and files will stop loading in BaseBuddy until each section is set up again. Your existing tables and stored files are not changed."
        : pendingUnmapTarget
          ? `${pendingUnmapTarget} will stop loading in BaseBuddy until this section is set up again. Your existing content is not changed.`
          : "";

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Manage workspace details, members, invitations, permissions, content mapping, and editor sidebar behavior.
        </p>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {getSettingsTabLabel(activeSettingsTab)}
        </p>
      </div>

      <Tabs value={activeSettingsTab}>
        <TabsContent value="general" className="space-y-6">
          {!canUpdateProject ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Only project owners and admins can update these settings.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="project-settings-name" className="text-xs font-medium uppercase tracking-wider">
              Project Name
            </Label>
            <Input
              id="project-settings-name"
              value={settingsNameDraft}
              onChange={(event) => setSettingsNameDraft(event.target.value)}
              className="h-10 border-border bg-secondary"
              disabled={!canUpdateProject || isSavingProjectSettings}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-settings-slug" className="text-xs font-medium uppercase tracking-wider">
              Project address
            </Label>
            <div className="relative">
              <Input
                id="project-settings-slug"
                value={settingsSlugDraft}
                onChange={(event) => setSettingsSlugDraft(normalizeProjectSlug(event.target.value))}
                className="h-10 border-border bg-secondary pr-10 font-mono text-sm"
                disabled={!canUpdateProject || isSavingProjectSettings || isProjectSlugLocked}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                onClick={isProjectSlugLocked ? handleProjectSlugUnlock : () => setIsProjectSlugLocked(true)}
                disabled={!canUpdateProject || isSavingProjectSettings}
              >
                {isProjectSlugLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                <span className="sr-only">{isProjectSlugLocked ? "Unlock project address" : "Lock project address"}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Project link: {nextProjectUrl}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-settings-website" className="text-xs font-medium uppercase tracking-wider">
              Website URL
            </Label>
            <Input
              id="project-settings-website"
              type="url"
              value={settingsWebsiteUrlDraft}
              onChange={(event) => setSettingsWebsiteUrlDraft(event.target.value)}
              className="h-10 border-border bg-secondary"
              placeholder="https://example.com"
              disabled={!canUpdateProject || isSavingProjectSettings}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Use this when the project is connected to a live website or publication.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
            <div className="text-xs text-muted-foreground">
              {hasProjectSettingsChanges ? "You have unsaved project changes." : "Project details are up to date."}
            </div>
            <Button
              type="button"
              variant="hero"
              size="sm"
              className="min-w-[112px]"
              onClick={() => void handleProjectSettingsSave()}
              disabled={
                !canUpdateProject ||
                isSavingProjectSettings ||
                !settingsNameDraft.trim() ||
                !normalizedSettingsSlug ||
                !hasProjectSettingsChanges
              }
            >
              {isSavingProjectSettings ? "Saving..." : "Save changes"}
            </Button>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Delete project</p>
              <p className="text-sm text-muted-foreground">
                {canDeleteProject
                  ? "Permanently remove this project and all of its settings. This cannot be undone"
                  : "Only members with permission to delete projects can perform this action."}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteProjectDialog(true)}
              disabled={!canDeleteProject || isDeletingProject}
            >
              Delete project
            </Button>
          </div>
        </TabsContent>

        {canUpdateProject ? (
          <TabsContent value="members" className="space-y-4">
            <ProjectMembersSettings projectId={projectId} />
          </TabsContent>
        ) : null}

        {canUpdateProject ? (
          <TabsContent value="invite-members" className="space-y-4">
            <ProjectMemberInvitationsSettings projectId={projectId} />
          </TabsContent>
        ) : null}

        {canUpdateProject ? (
          <TabsContent value="permissions" className="space-y-4">
            <ProjectPermissionsSettings projectId={projectId} />
          </TabsContent>
        ) : null}

        {canUpdateProject ? (
          <TabsContent value="sidebar-fields" className="space-y-6">
            <ProjectEditorPostSidebarSettings
              canUpdateProject={canUpdateProject}
              contentRuntime={contentRuntime}
              hasPostSidebarConfigChanges={hasPostSidebarConfigChanges}
              isSavingPostSidebarConfig={isSavingPostSidebarConfig}
              onPostSidebarConfigChange={setPostSidebarConfigDraft}
              onResetPostSidebarConfigToDefault={handlePostSidebarConfigResetToDefault}
              onRestoreSavedPostSidebarConfig={handlePostSidebarConfigRestoreSaved}
              onSavePostSidebarConfig={handlePostSidebarConfigSave}
              postSidebarConfig={postSidebarConfigDraft}
              supportsPostRevisions={supportsPostRevisions}
            />
          </TabsContent>
        ) : null}

        {canUpdateProject ? (
          <TabsContent value="mapping" className="space-y-7">
            <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-base font-medium text-foreground">Content mapping</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  BaseBuddy reads your saved mapping to decide which tables, fields, relations, media, and files appear
                  in the editor. Changing mapping does not rename tables or reshape your database.
                </p>
                <p className="text-xs text-muted-foreground">
                  {mappedSectionCount} of {mappingSections.length} sections connected.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-destructive"
                onClick={() => setPendingUnmapTarget("all")}
                disabled={!hasMappedSection || isSettingsMappingBusy}
              >
                {unmappingSettingsTarget === "all" ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Removing mapping...
                  </>
                ) : (
                  "Remove all mapping"
                )}
              </Button>
            </div>

            {settingsMappingError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                <p className="text-sm text-destructive">{settingsMappingError}</p>
              </div>
            ) : null}

            <div className="divide-y divide-border border-y border-border">
              {mappingSections.map((section) => {
                const setupCopy =
                  section.collection === "Posts"
                    ? null
                    : getProjectEditorCollectionSetupCopy(section.collection, {
                        workspaceState,
                      });
                const loadingThisSection = loadingSettingsMappingCollection === section.collection;
                const actionLabel =
                  section.collection === "Posts"
                    ? "Open Posts mapping"
                    : workspaceState === "mapping_draft" &&
                        (section.collection === "Authors" ||
                          section.collection === "Categories" ||
                          section.collection === "Tags")
                      ? "Map Posts first"
                      : `Open ${section.collection} mapping`;
                const description = setupCopy?.description ?? section.description;
                const isMapped = isCollectionMapped(section.collection);
                const isUnmappingThisSection = unmappingSettingsTarget === section.collection;

                return (
                  <div key={section.collection} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{section.title}</p>
                        <span className={[
                          "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium",
                          isMapped
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground",
                        ].join(" ")}>
                          {isMapped ? <Check className="h-3 w-3" /> : null}
                          {isMapped ? "Connected" : "Not connected"}
                        </span>
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => void handleOpenSettingsMapping(section.collection)}
                        disabled={isSettingsMappingBusy}
                      >
                        {loadingThisSection ? (
                          <>
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Loading mapping...
                          </>
                        ) : (
                          <>
                            <Database className="h-3.5 w-3.5" />
                            {actionLabel}
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${section.collection} mapping`}
                        className="gap-2 text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingUnmapTarget(section.collection)}
                        disabled={!isMapped || isSettingsMappingBusy}
                      >
                        {isUnmappingThisSection ? (
                          <>
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Removing mapping...
                          </>
                        ) : (
                          "Remove"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <AlertDialog
              open={pendingUnmapTarget !== null}
              onOpenChange={(open) => {
                if (!open && unmappingSettingsTarget === null) {
                  setPendingUnmapTarget(null);
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{pendingUnmapHeading}</AlertDialogTitle>
                  <AlertDialogDescription>{pendingUnmapDescription}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    disabled={unmappingSettingsTarget !== null}
                    onClick={() => setPendingUnmapTarget(null)}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (!pendingUnmapTarget) {
                        return;
                      }

                      void (async () => {
                        try {
                          await handleUnmapSettingsMapping(pendingUnmapTarget);
                          setPendingUnmapTarget(null);
                        } catch {
                          // The parent handler already surfaces the error and keeps the dialog open.
                        }
                      })();
                    }}
                    disabled={unmappingSettingsTarget !== null}
                  >
                    {unmappingSettingsTarget !== null ? "Removing..." : "Remove mapping"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
