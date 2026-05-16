import type { ContentPostSidebarConfig } from "@/lib/content-runtime/shared";

type ProjectEditorMutationErrorPayload = {
  error?: string;
};

type ProjectEditorContentAction = {
  action: string;
  [key: string]: unknown;
};

type PostProjectContentMutationInput = {
  action: ProjectEditorContentAction;
  fallbackMessage: string;
  projectId: string;
};

type UpdateProjectSettingsMutationInput = {
  currentSlug: string;
  name: string;
  projectId: string;
  slug: string;
  websiteUrl: string | null;
};

type SaveProjectPostSidebarConfigMutationInput = {
  postSidebarConfig: ContentPostSidebarConfig;
  projectId: string;
};

type DeleteProjectMutationInput = {
  projectId: string;
};

const readJson = async <T>(response: Response): Promise<T & ProjectEditorMutationErrorPayload> =>
  (await response.json()) as T & ProjectEditorMutationErrorPayload;

const throwIfFailed = <T extends ProjectEditorMutationErrorPayload>({
  fallbackMessage,
  payload,
  response,
}: {
  fallbackMessage: string;
  payload: T;
  response: Pick<Response, "ok">;
}) => {
  if (!response.ok) {
    throw new Error(payload.error ?? fallbackMessage);
  }
};

export const requestProjectContentMutation = async <T = ProjectEditorMutationErrorPayload>({
  action,
  projectId,
}: Omit<PostProjectContentMutationInput, "fallbackMessage">): Promise<{
  ok: boolean;
  payload: T & ProjectEditorMutationErrorPayload;
  status: number;
}> => {
  const response = await fetch(`/api/projects/${projectId}/content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });
  const payload = await readJson<T>(response);

  return {
    ok: response.ok,
    payload,
    status: response.status,
  };
};

export const postProjectContentMutation = async <T = ProjectEditorMutationErrorPayload>({
  action,
  fallbackMessage,
  projectId,
}: PostProjectContentMutationInput): Promise<T & ProjectEditorMutationErrorPayload> => {
  const { ok, payload } = await requestProjectContentMutation<T>({
    action,
    projectId,
  });

  throwIfFailed({
    fallbackMessage,
    payload,
    response: { ok },
  });

  return payload;
};

export const requestProjectEditorContentAction = requestProjectContentMutation;
export const runProjectEditorContentAction = postProjectContentMutation;

export const updateProjectSettingsMutation = async ({
  currentSlug,
  name,
  projectId,
  slug,
  websiteUrl,
}: UpdateProjectSettingsMutationInput) => {
  const response = await fetch(`/api/projects/${projectId}/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentSlug,
      name,
      slug,
      websiteUrl,
    }),
  });
  const payload = await readJson<{
    project?: {
      id: string;
      name: string;
      slug: string;
      websiteUrl: string | null;
    };
  }>(response);

  throwIfFailed({
    fallbackMessage: "Could not update this project right now.",
    payload,
    response,
  });

  return payload;
};

export const saveProjectPostSidebarConfigMutation = async ({
  postSidebarConfig,
  projectId,
}: SaveProjectPostSidebarConfigMutationInput) => {
  const response = await fetch(`/api/projects/${projectId}/settings/sidebar-fields`, {
    body: JSON.stringify({
      postSidebarConfig,
      source: "manual",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });
  const payload = await readJson<{
    postSidebarConfig?: ContentPostSidebarConfig;
  }>(response);

  throwIfFailed({
    fallbackMessage: "Could not save the sidebar layout right now.",
    payload,
    response,
  });

  return payload;
};

export const deleteProjectMutation = async ({ projectId }: DeleteProjectMutationInput) => {
  const response = await fetch(`/api/projects/${projectId}/settings`, {
    method: "DELETE",
  });
  const payload = await readJson<{ success?: boolean }>(response);

  throwIfFailed({
    fallbackMessage: "Could not delete this project right now.",
    payload,
    response,
  });

  return payload;
};
