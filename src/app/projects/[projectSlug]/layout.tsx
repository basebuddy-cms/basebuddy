import { ProjectWorkspacePage } from "@/components/editor/project-workspace-page";

type ProjectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ projectSlug: string }>;
};

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectSlug } = await params;

  return (
    <>
      <ProjectWorkspacePage projectSlug={projectSlug} />
      {children}
    </>
  );
}
