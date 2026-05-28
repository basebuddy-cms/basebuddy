import "server-only";

import { randomBytes } from "node:crypto";

import { getConfigProjectMemberInvitationPreview } from "@/lib/basebuddy-config/projects";
import type { ProjectMemberInvitationPreview } from "./member-invitations";

export const createProjectMemberInvitationToken = () => randomBytes(24).toString("base64url");

const logProjectMemberInvitationPreviewError = (
  error: unknown,
  metadata: Record<string, string | number | null | undefined> = {},
) => {
  console.error("[project-member-invitation-preview]", {
    error,
    ...metadata,
  });
};

export const getProjectMemberInvitationPreview = async (
  publicToken: string,
): Promise<ProjectMemberInvitationPreview | null> => {
  const normalizedToken = publicToken.trim();

  if (!normalizedToken) {
    return null;
  }

  try {
    return await getConfigProjectMemberInvitationPreview(normalizedToken);
  } catch (error) {
    logProjectMemberInvitationPreviewError(error, {
      publicTokenSuffix: normalizedToken.slice(-6),
    });
    return null;
  }
};
