"use client";

import React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectEditorFieldLabel } from "@/components/editor/project-editor/text-field-controls";

type ProjectEditorRangeFieldProps = {
  disabled?: boolean;
  id: string;
  label: React.ReactNode;
  onChange: (value: string | null) => void;
  required?: boolean;
  value: string | null;
};

type ProjectEditorMultirangeFieldProps = {
  disabled?: boolean;
  id: string;
  label: React.ReactNode;
  onChange: (value: string | null) => void;
  required?: boolean;
  value: string | null;
};

export function ProjectEditorRangeField({
  disabled = false,
  id,
  label,
  onChange,
  required = false,
  value,
}: ProjectEditorRangeFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Input
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)}
        className="h-8 border-border font-mono text-xs"
        disabled={disabled}
        placeholder='[2026-01-01,2026-12-31)'
      />
    </div>
  );
}

export function ProjectEditorMultirangeField({
  disabled = false,
  id,
  label,
  onChange,
  required = false,
  value,
}: ProjectEditorMultirangeFieldProps) {
  return (
    <div>
      <ProjectEditorFieldLabel htmlFor={id} label={label} required={required} />
      <Textarea
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)}
        rows={3}
        className="border-border font-mono text-xs"
        disabled={disabled}
        placeholder='{"[2026-01-01,2026-03-31)","[2026-07-01,2026-09-30)"}'
      />
    </div>
  );
}
