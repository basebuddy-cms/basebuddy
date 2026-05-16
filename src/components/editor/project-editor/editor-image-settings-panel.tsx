"use client";

import React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProjectEditorSelectedImage = {
  align: "center" | "left" | "right" | "";
  alt: string;
  height: string;
  linkHref: string;
  src: string;
  width: string;
};

type ProjectEditorImageSettingsPanelProps = {
  image: ProjectEditorSelectedImage;
  onChange: (updates: Partial<ProjectEditorSelectedImage> & {
    align?: ProjectEditorSelectedImage["align"] | null;
    height?: string | null;
    linkHref?: string | null;
    width?: string | null;
  }) => void;
  onClose: () => void;
  onRemove: () => void;
};

const normalizeDimensionInput = (value: string) => {
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
};

export function ProjectEditorImageSettingsPanel({
  image,
  onChange,
  onClose,
  onRemove,
}: ProjectEditorImageSettingsPanelProps) {
  const alignmentOptions = [
    { icon: AlignLeft, label: "Align left", value: "left" },
    { icon: AlignCenter, label: "Align center", value: "center" },
    { icon: AlignRight, label: "Align right", value: "right" },
  ] as const;

  return (
    <aside className="flex w-80 flex-shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold text-foreground">Image settings</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close image settings">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
        <div className="overflow-hidden rounded-md border border-border bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.src} alt={image.alt || ""} className="max-h-44 w-full object-contain" />
        </div>

        <div className="space-y-2">
          <Label>Alignment</Label>
          <div className="grid grid-cols-3 gap-2">
            {alignmentOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={image.align === option.value ? "secondary" : "outline"}
                size="icon"
                aria-label={option.label}
                onClick={() => onChange({ align: image.align === option.value ? "" : option.value })}
              >
                <option.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="selected-image-alt">Alt text</Label>
          <Input
            id="selected-image-alt"
            value={image.alt}
            onChange={(event) => onChange({ alt: event.target.value })}
            placeholder="Describe the image"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="selected-image-link">Image link</Label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="selected-image-link"
              value={image.linkHref}
              onChange={(event) => onChange({ linkHref: event.target.value.trim() || null })}
              placeholder="https://example.com"
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="selected-image-width">Width</Label>
            <Input
              id="selected-image-width"
              inputMode="numeric"
              value={image.width}
              onChange={(event) => onChange({ width: normalizeDimensionInput(event.target.value) })}
              placeholder="Auto"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="selected-image-height">Height</Label>
            <Input
              id="selected-image-height"
              inputMode="numeric"
              value={image.height}
              onChange={(event) => onChange({ height: normalizeDimensionInput(event.target.value) })}
              placeholder="Auto"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
          Remove image
        </Button>
      </div>
    </aside>
  );
}
