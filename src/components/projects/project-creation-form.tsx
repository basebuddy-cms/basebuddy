"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { ProjectCreationFields } from "@/components/projects/project-creation-fields";
import { useProjectCreationSlugState } from "@/components/projects/project-creation-hooks";
import { OLD_PROJECT_CREATION_DRAFT_KEYS } from "@/components/projects/project-creation-shared";
import { Button } from "@/components/ui/button";
import { normalizeProjectSlug } from "@/lib/control-plane/utils";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";

export function ProjectCreationForm() {
  const router = useRouter();
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const slugState = useProjectCreationSlugState({
    projectName,
    projectSlug,
    setProjectSlug,
    slugTouched,
  });

  useEffect(() => {
    for (const key of OLD_PROJECT_CREATION_DRAFT_KEYS) {
      window.sessionStorage.removeItem(key);
    }
  }, []);

  const canCreateProject = Boolean(projectName.trim()) && slugState.status === "available";

  const handleCreateProject = async () => {
    if (!canCreateProject) {
      toast.error("Enter a project name and wait for the address check to finish.");
      return;
    }

    setCreatingProject(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: projectName.trim(),
          projectSlug: projectSlug.trim(),
        }),
      });

      const payload = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok || !payload.redirectTo) {
        throw new Error(payload.error ?? "Could not create the project right now.");
      }

      router.push(payload.redirectTo);
    } catch (error) {
      toast.error(getProductionErrorMessage(error, "Could not create the project right now."));
      setCreatingProject(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ProjectCreationFields
        projectName={projectName}
        projectSlug={projectSlug}
        slugState={slugState}
        onProjectNameChange={setProjectName}
        onProjectSlugChange={(value) => {
          setSlugTouched(true);
          setProjectSlug(normalizeProjectSlug(value));
        }}
      />

      <div className="flex justify-end">
        <Button
          variant="hero"
          size="sm"
          onClick={handleCreateProject}
          disabled={!canCreateProject || creatingProject}
          className="gap-2"
        >
          {creatingProject ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Create project
        </Button>
      </div>
    </div>
  );
}
