"use client";

import React, { type ComponentType } from "react";
import dynamic from "next/dynamic";

import { ProjectEditorTablePageSkeleton } from "@/components/editor/project-editor/collection-body";

type ProjectEditorDeferredSurfaceProps = Record<string, unknown>;

const ProjectEditorDeferredSurfaceFallback = ({
  message,
}: {
  message: string;
}) => (
  <div className="flex min-h-[240px] items-center justify-center px-6 py-10 text-sm text-muted-foreground">
    {message}
  </div>
);

const ProjectEditorDeferredCollectionFallback = () => <ProjectEditorTablePageSkeleton />;

export const ProjectSettingsView = dynamic(
  () =>
    import("@/components/editor/project-editor/settings-view").then(
      (mod) =>
        mod.ProjectSettingsView as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: ProjectEditorDeferredCollectionFallback,
  },
);

export const ProjectAuthorsManager = dynamic(
  () =>
    import("@/components/editor/project-authors-manager").then(
      (mod) =>
        mod.ProjectAuthorsManager as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: ProjectEditorDeferredCollectionFallback,
  },
);

export const ProjectMediaManager = dynamic(
  () =>
    import("@/components/editor/project-media-manager").then(
      (mod) =>
        mod.ProjectMediaManager as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: ProjectEditorDeferredCollectionFallback,
  },
);

export const ProjectFilesManager = dynamic(
  () =>
    import("@/components/editor/project-files-manager").then(
      (mod) =>
        mod.ProjectFilesManager as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: ProjectEditorDeferredCollectionFallback,
  },
);

export const ProjectEditorTaxonomyCollectionPage = dynamic(
  () =>
    import("@/components/editor/project-editor/taxonomy-ui").then(
      (mod) =>
        mod.ProjectEditorTaxonomyCollectionPage as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: ProjectEditorDeferredCollectionFallback,
  },
);

export const ProjectEditorTaxonomySidePanel = dynamic(
  () =>
    import("@/components/editor/project-editor/taxonomy-ui").then(
      (mod) =>
        mod.ProjectEditorTaxonomySidePanel as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: () => (
      <ProjectEditorDeferredSurfaceFallback message="Loading taxonomy tools..." />
    ),
  },
);

export const ProjectEditorPostSidePanel = dynamic(
  () =>
    import("@/components/editor/project-editor/post-side-panel").then(
      (mod) =>
        mod.ProjectEditorPostSidePanel as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: () => (
      <ProjectEditorDeferredSurfaceFallback message="Loading post tools..." />
    ),
  },
);

export const ProjectEditorPostsMappingWorkspace = dynamic(
  () =>
    import("@/components/editor/project-editor/posts-mapping-workspace").then(
      (mod) =>
        mod.ProjectEditorPostsMappingWorkspace as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: () => (
      <ProjectEditorDeferredSurfaceFallback message="Loading mapping setup..." />
    ),
  },
);

export const ProjectEditorDialogs = dynamic(
  () =>
    import("@/components/editor/project-editor/dialogs").then(
      (mod) =>
        mod.ProjectEditorDialogs as ComponentType<ProjectEditorDeferredSurfaceProps>,
    ),
  {
    loading: () => null,
  },
);
