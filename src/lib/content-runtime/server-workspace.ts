import "server-only";

import type { ContentWorkspaceMeta } from "./shared";
import {
  getContentSnapshotForMappedContent,
  getContentWorkspaceSummaryForMappedContent,
  getContentWorkspaceMetaForMappedContent,
} from "./server-workspace-mapped-content";
import type { SnapshotResponse, WorkspaceDependencies } from "./server-workspace-shared";

export const getContentWorkspaceMeta = async ({
  dependencies,
  projectId,
}: {
  dependencies: WorkspaceDependencies;
  projectId: string;
}): Promise<ContentWorkspaceMeta> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  return getContentWorkspaceMetaForMappedContent({
    context,
    dependencies,
    projectId,
  });
};

export const getContentSnapshot = async ({
  dependencies,
  projectId,
}: {
  dependencies: WorkspaceDependencies;
  projectId: string;
}): Promise<SnapshotResponse> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  return getContentSnapshotForMappedContent({
    context,
    dependencies,
    projectId,
  });
};

export const getContentWorkspaceSummary = async ({
  dependencies,
  projectId,
}: {
  dependencies: WorkspaceDependencies;
  projectId: string;
}): Promise<ContentWorkspaceMeta["workspaceSummary"]> => {
  const context = await dependencies.getProjectContext(projectId);

  if (!context) {
    throw new Error("Could not load this project right now.");
  }

  return getContentWorkspaceSummaryForMappedContent({
    context,
    dependencies,
    projectId,
  });
};
