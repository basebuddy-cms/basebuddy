import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, MoreHorizontal, Plus, Search, X } from "lucide-react";

import { AccountMenu } from "@/components/account/account-menu";
import { BaseBuddyWordmark } from "@/components/basebuddy-mark";
import { AppSetupNotice } from "@/components/projects/app-setup-notice";
import { ProjectCreationForm } from "@/components/projects/project-creation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectsPageBootstrap } from "@/lib/control-plane/server";
import { formatProjectDate, getProjectRoleLabel } from "@/lib/control-plane/utils";
import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
} from "@/lib/basebuddy-config/setup";

type ProjectsRouteSearchParams = Record<string, string | string[] | undefined>;

type ProjectsRouteProps = {
  searchParams?: ProjectsRouteSearchParams | Promise<ProjectsRouteSearchParams>;
};

const getSingleSearchParamValue = (
  searchParams: ProjectsRouteSearchParams | undefined,
  key: string,
) => {
  const value = searchParams?.[key];

  return Array.isArray(value) ? value[0] : value;
};

export default async function ProjectsRoute({ searchParams }: ProjectsRouteProps = {}) {
  const setupStatus = await getBaseBuddyConfigSetupStatus();

  if (!isBaseBuddyConfigSetupReady(setupStatus)) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = await searchParams;
  const requestedSearch = getSingleSearchParamValue(resolvedSearchParams, "q") ?? "";
  const {
    account,
    errorMessage,
    hasMoreProjects,
    projects,
    projectSearchQuery,
    setupRequired,
  } = await getProjectsPageBootstrap({
    search: requestedSearch,
  });
  const hasProjects = projects.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/projects" className="flex h-14 items-center">
              <BaseBuddyWordmark className="h-7 w-auto" />
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-foreground">Projects</span>
          </div>
          <div className="flex items-center gap-3">
            <AccountMenu
              avatarUrl={account.avatarUrl}
              email={account.email}
              name={account.name}
            />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your connected content projects</p>
          </div>
          {hasProjects ? (
            <Button variant="hero" size="sm" asChild>
              <a href="#new-project" className="gap-2">
                <Plus className="h-4 w-4" />
                New project
              </a>
            </Button>
          ) : null}
        </div>

        {setupRequired ? (
          <AppSetupNotice />
        ) : (
          <>
            {errorMessage ? (
              <Card className="mb-6 border-border bg-card shadow-sm">
                <CardContent className="px-4 py-3 text-sm text-muted-foreground">
                  {errorMessage}
                </CardContent>
              </Card>
            ) : null}

            {hasProjects || projectSearchQuery ? (
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <form action="/projects" className="flex w-full max-w-md items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      aria-label="Search projects"
                      className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                      defaultValue={projectSearchQuery}
                      name="q"
                      placeholder="Search projects"
                      type="search"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    Search
                  </Button>
                  {projectSearchQuery ? (
                    <Button asChild type="button" variant="ghost" size="icon" aria-label="Clear project search">
                      <Link href="/projects" prefetch={false}>
                        <X className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </form>
                {hasMoreProjects ? (
                  <p className="text-sm text-muted-foreground">
                    Showing the first projects. Search to narrow the list.
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasProjects ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.slug}`}
                    prefetch={false}
                    className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card className="h-full min-h-[168px] border-border bg-card shadow-sm transition-colors group-hover:border-muted-foreground/30">
                      <CardHeader className="flex flex-row items-start justify-between gap-4 p-4 pb-3">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="truncate text-lg transition-colors group-hover:text-primary">
                            {project.name}
                          </CardTitle>
                          <CardDescription className="truncate">
                            {project.slug}
                          </CardDescription>
                        </div>
                        <div className="rounded-md border border-border bg-secondary/70 p-2 text-muted-foreground transition-colors group-hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </div>
                      </CardHeader>

                      <CardContent className="px-4 pb-3 pt-0">
                        <Badge
                          variant="secondary"
                          className="gap-1.5 border-transparent bg-success/10 font-medium text-success hover:bg-success/10"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          {getProjectRoleLabel(project.role)}
                        </Badge>
                      </CardContent>

                      <CardFooter className="mt-auto items-end justify-between px-4 pb-4 pt-2">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground">
                            Created
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {formatProjectDate(project.createdAt)}
                          </p>
                        </div>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-border bg-card text-center shadow-sm">
                <CardContent className="p-10">
                  <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <CardTitle className="text-sm">
                    {projectSearchQuery ? "No matching projects" : "No projects yet"}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    {projectSearchQuery
                      ? "Try another search or clear the search field."
                      : "Create your first project, then connect your content."}
                  </CardDescription>
                  {projectSearchQuery ? null : (
                    <div id="new-project" className="mt-6">
                      <ProjectCreationForm />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {hasProjects ? (
              <Card id="new-project" className="mt-6 border-dashed border-border bg-card text-center shadow-sm">
                <CardContent className="p-8">
                  <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <CardDescription className="text-sm">
                    Need another project? Start a new one.
                  </CardDescription>
                  <div className="mt-6">
                    <ProjectCreationForm />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
