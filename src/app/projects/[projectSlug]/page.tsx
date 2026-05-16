import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  redirect(`/projects/${projectSlug}/posts`);
}
