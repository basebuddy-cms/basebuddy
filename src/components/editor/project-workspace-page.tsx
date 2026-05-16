import { notFound, redirect } from "next/navigation";

import { ProjectEditor } from "@/components/editor/project-editor";
import { normalizeRoutePageNumber } from "@/components/editor/project-editor/utils";
import { AppSetupNotice } from "@/components/projects/app-setup-notice";
import {
  getProjectPageBootstrapBySlug,
} from "@/lib/control-plane/server";
import { prewarmContentProjectContext } from "@/lib/content-runtime/server-project-context";

type ProjectWorkspacePageProps = {
  projectSlug: string;
  requestedPostsPage?: string | string[] | undefined;
  requestedSection?: "Authors" | "Categories" | "Files" | "Media" | "Posts" | "Settings" | "Tags";
  requestedSettingsTab?: string | string[] | undefined;
};

const normalizeRequestedSettingsTab = ({
  canUpdateProject,
  value,
}: {
  canUpdateProject: boolean;
  value: string | string[] | undefined;
}) => {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalizedValue === "members" && canUpdateProject) {
    return "members";
  }

  if (normalizedValue === "invite-members" && canUpdateProject) {
    return "invite-members";
  }

  if (normalizedValue === "permissions" && canUpdateProject) {
    return "permissions";
  }

  if (normalizedValue === "sidebar-fields" && canUpdateProject) {
    return "sidebar-fields";
  }

  if (normalizedValue === "mapping" && canUpdateProject) {
    return "mapping";
  }

  return "general";
};

export async function ProjectWorkspacePage({
  projectSlug,
  requestedPostsPage,
  requestedSection,
  requestedSettingsTab,
}: ProjectWorkspacePageProps) {
  const { account, errorMessage, project, setupRequired } = await getProjectPageBootstrapBySlug(projectSlug);

  if (setupRequired) {
    return (
      <div className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <AppSetupNotice ctaHref="/projects" ctaLabel="Back to projects" />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!project) {
    notFound();
  }

  const canManageAuthorDirectory = project.role === "owner" || project.role === "admin";
  const canUpdateProject = canManageAuthorDirectory;

  if (requestedSection === "Authors" && !canManageAuthorDirectory) {
    redirect(`/projects/${project.slug}/posts`);
  }

  if (requestedSection === "Settings") {
    const normalizedSettingsTab = normalizeRequestedSettingsTab({
      canUpdateProject,
      value: requestedSettingsTab,
    });
    const currentSettingsTab = typeof requestedSettingsTab === "string" ? requestedSettingsTab.trim().toLowerCase() : "";

    if (currentSettingsTab !== normalizedSettingsTab) {
      redirect(`/projects/${project.slug}/settings?tab=${normalizedSettingsTab}`);
    }
  }

  if (requestedSection === "Posts" && requestedPostsPage !== undefined) {
    const normalizedRequestedPostsPage = normalizeRoutePageNumber(requestedPostsPage);

    if (!normalizedRequestedPostsPage || normalizedRequestedPostsPage === 1) {
      redirect(`/projects/${project.slug}/posts`);
    }
  }

  const initialRequestedSettingsTab =
    typeof requestedSettingsTab === "string" ? requestedSettingsTab.trim().toLowerCase() : null;

  prewarmContentProjectContext({
    projectId: project.id,
    projectSlug: project.slug,
  });

  return (
    <ProjectEditor
      accountAvatarUrl={account.avatarUrl}
      accountEmail={account.email}
      accountName={account.name}
      initialRequestedSettingsTab={initialRequestedSettingsTab}
      initialWorkspacePayload={null}
      projectId={project.id}
      projectName={project.name}
      projectRole={project.role}
      projectSlug={project.slug}
      projectWebsiteUrl={project.websiteUrl}
    />
  );
}
