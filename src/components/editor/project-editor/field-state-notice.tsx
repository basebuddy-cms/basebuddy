"use client";

import React from "react";

type ProjectEditorFieldStateNoticeProps = {
  currentValue?: React.ReactNode;
  helperText: React.ReactNode;
  label: React.ReactNode;
};

export function ProjectEditorFieldStateNotice({
  currentValue,
  helperText,
  label,
}: ProjectEditorFieldStateNoticeProps) {
  return (
    <div>
      <div className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="rounded-md border border-dashed border-border bg-secondary px-3 py-4">
        <p className="text-xs text-muted-foreground">{helperText}</p>
        {currentValue ? (
          <div className="mt-1.5 break-words text-xs text-foreground">{currentValue}</div>
        ) : null}
      </div>
    </div>
  );
}
