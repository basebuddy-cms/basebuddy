"use client";

import React from "react";

import { getSlugStateToneClass, type SlugState } from "@/components/projects/project-creation-shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ProjectCreationFieldsProps = {
  onProjectNameChange: (value: string) => void;
  onProjectSlugChange: (value: string) => void;
  projectName: string;
  projectSlug: string;
  slugState: SlugState;
};

export function ProjectCreationFields({
  onProjectNameChange,
  onProjectSlugChange,
  projectName,
  projectSlug,
  slugState,
}: ProjectCreationFieldsProps) {
  return (
    <div className="space-y-5 text-left">
      <div>
        <Label
          htmlFor="project-name"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Project name
        </Label>
        <Input
          id="project-name"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          placeholder="Marketing site"
          className="border-border"
        />
      </div>

      <div>
        <Label
          htmlFor="project-slug"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Project address
        </Label>
        <Input
          id="project-slug"
          value={projectSlug}
          onChange={(event) => onProjectSlugChange(event.target.value)}
          placeholder="marketing-site"
          className="border-border font-mono text-sm"
        />
        <p className={cn("mt-2 text-xs", getSlugStateToneClass(slugState.status))}>
          {slugState.status === "checking" ? "Checking address availability..." : slugState.detail}
        </p>
      </div>
    </div>
  );
}
