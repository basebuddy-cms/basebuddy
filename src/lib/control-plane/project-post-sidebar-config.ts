import "server-only";

import { getProductionErrorMessage } from "@/lib/errors/user-facing";
import {
  APP_SETUP_REQUIRED_MESSAGE,
  isControlPlaneSetupError,
} from "@/lib/control-plane/server";
import {
  normalizeContentPostSidebarConfig,
  createDefaultContentPostSidebarConfig,
  type ContentPostSidebarConfig,
} from "@/lib/content-runtime/shared";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const projectPostSidebarConfigSourceValues = ["manual", "system"] as const;
export type ProjectPostSidebarConfigSource = (typeof projectPostSidebarConfigSourceValues)[number];

type ProjectPostSidebarConfigRow = {
  sidebar_config?: unknown;
  sidebarConfig?: unknown;
};

export const getProjectPostSidebarConfig = async (
  projectId: string,
): Promise<ContentPostSidebarConfig> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_project_content_sidebar_config", {
    p_project_id: projectId,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      console.warn("[project-post-sidebar-config] Falling back to the default sidebar config.", {
        error,
        projectId,
      });
      return createDefaultContentPostSidebarConfig();
    }

    throw new Error(getProductionErrorMessage(error, "Could not load the sidebar fields for this project."));
  }

  const row = (Array.isArray(data) ? data[0] : data) as ProjectPostSidebarConfigRow | null;

  return normalizeContentPostSidebarConfig(row?.sidebar_config ?? row?.sidebarConfig);
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_project_content_sidebar_config", {
    p_project_id: projectId,
    p_sidebar_config: normalizedConfig,
    p_source: source,
  });

  if (error) {
    if (isControlPlaneSetupError(error)) {
      throw new Error(APP_SETUP_REQUIRED_MESSAGE);
    }

    throw new Error(getProductionErrorMessage(error, "Could not save the sidebar fields for this project."));
  }

  return normalizedConfig;
};
