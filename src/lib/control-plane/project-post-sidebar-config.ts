import "server-only";

import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  getConfigProjectPostSidebarConfig,
  saveConfigProjectPostSidebarConfig,
} from "@/lib/basebuddy-config/projects";
import {
  normalizeContentPostSidebarConfig,
  type ContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";

export const projectPostSidebarConfigSourceValues = ["manual", "system"] as const;
export type ProjectPostSidebarConfigSource = (typeof projectPostSidebarConfigSourceValues)[number];

export const getProjectPostSidebarConfig = async (
  projectId: string,
): Promise<ContentPostSidebarConfig> => {
  try {
    return await getConfigProjectPostSidebarConfig(projectId);
  } catch (error) {
    throw new Error(getProductionErrorMessage(error, "Could not load the sidebar fields for this project."));
  }
};

export const saveProjectPostSidebarConfig = async ({
  config,
  projectId,
  source = "manual",
}: {
  config: ContentPostSidebarConfig;
  projectId: string;
  source?: ProjectPostSidebarConfigSource;
}): Promise<ContentPostSidebarConfig> => {
  const normalizedConfig = normalizeContentPostSidebarConfig(config);
  try {
    return await saveConfigProjectPostSidebarConfig({
      config: normalizedConfig,
      projectId,
      source,
    });
  } catch (error) {
    throw new Error(getProductionErrorMessage(error, "Could not save the sidebar fields for this project."));
  }
};
