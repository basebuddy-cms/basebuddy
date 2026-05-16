"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Link as LinkIcon, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";

type LinkRelFlag = "nofollow" | "ugc" | "sponsored";

type EditorLinkState = {
  href: string;
  openInNewTab: boolean;
  relFlags: Set<LinkRelFlag>;
};

type EditorLinkPopoverProps = {
  autoFocusInput?: boolean;
  anchorRect: { x: number; y: number } | null;
  onApply: (state: EditorLinkState) => void;
  onClose: () => void;
  onUnlink: () => void;
  open: boolean;
  initialHref?: string;
  initialTarget?: string | null;
  initialRel?: string | null;
  isEditing: boolean;
};

const REL_OPTIONS: { flag: LinkRelFlag; label: string; description: string }[] = [
  { flag: "nofollow", label: "Nofollow", description: "Tells search engines not to follow this link" },
  { flag: "ugc", label: "UGC", description: "Marks as user-generated content" },
  { flag: "sponsored", label: "Sponsored", description: "Marks as a paid or sponsored link" },
];

function parseRelFlags(rel: string | null | undefined): Set<LinkRelFlag> {
  if (!rel) return new Set();

  const parts = rel.split(/\s+/).map((s) => s.toLowerCase());
  const flags = new Set<LinkRelFlag>();

  if (parts.includes("nofollow")) flags.add("nofollow");
  if (parts.includes("ugc")) flags.add("ugc");
  if (parts.includes("sponsored")) flags.add("sponsored");

  return flags;
}

function buildRelString(flags: Set<LinkRelFlag>, openInNewTab: boolean): string {
  const parts: string[] = [];

  if (openInNewTab) {
    parts.push("noopener", "noreferrer");
  }

  if (flags.has("nofollow")) parts.push("nofollow");
  if (flags.has("ugc")) parts.push("ugc");
  if (flags.has("sponsored")) parts.push("sponsored");

  return parts.join(" ");
}

export function EditorLinkPopover({
  autoFocusInput = true,
  anchorRect,
  onApply,
  onClose,
  onUnlink,
  open,
  initialHref = "",
  initialTarget,
  initialRel,
  isEditing,
}: EditorLinkPopoverProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [href, setHref] = useState(initialHref);
  const [openInNewTab, setOpenInNewTab] = useState(initialTarget === "_blank" || !isEditing);
  const [relFlags, setRelFlags] = useState<Set<LinkRelFlag>>(() => parseRelFlags(initialRel));

  useEffect(() => {
    if (open) {
      setHref(initialHref);
      setOpenInNewTab(initialTarget === "_blank" || !isEditing);
      setRelFlags(parseRelFlags(initialRel));

      if (autoFocusInput) {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      }
    }
  }, [autoFocusInput, open, initialHref, initialTarget, initialRel, isEditing]);

  const toggleRelFlag = (flag: LinkRelFlag) => {
    setRelFlags((prev) => {
      const next = new Set(prev);

      if (next.has(flag)) {
        next.delete(flag);
      } else {
        next.add(flag);
      }

      return next;
    });
  };

  const handleApply = () => {
    const trimmed = href.trim();

    if (!trimmed) {
      if (isEditing) {
        onUnlink();
      } else {
        onClose();
      }

      return;
    }

    onApply({ href: trimmed, openInNewTab, relFlags });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleApply();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <PopoverPrimitive.Anchor
        style={{
          position: "fixed",
          left: anchorRect?.x ?? 0,
          top: anchorRect?.y ?? 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-80 p-0"
        data-editor-link-popover="true"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {isEditing ? "Edit link" : "Insert link"}
            </span>
          </div>

          <div>
            <Input
              ref={inputRef}
              value={href}
              onChange={(event) => setHref(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="h-9"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="link-new-tab"
                checked={openInNewTab}
                onCheckedChange={(checked) => setOpenInNewTab(checked === true)}
              />
              <Label htmlFor="link-new-tab" className="flex cursor-pointer items-center gap-1.5 text-xs normal-case tracking-normal">
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                Open in new tab
              </Label>
            </div>

            {REL_OPTIONS.map((option) => (
              <div key={option.flag} className="flex items-start gap-2">
                <Checkbox
                  id={`link-rel-${option.flag}`}
                  checked={relFlags.has(option.flag)}
                  onCheckedChange={() => toggleRelFlag(option.flag)}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor={`link-rel-${option.flag}`} className="cursor-pointer text-xs normal-case tracking-normal">
                    {option.label}
                  </Label>
                  <p className="text-[11px] leading-tight text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onUnlink}
            >
              <Unlink className="h-3 w-3" />
              Unlink
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="hero"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleApply}
              disabled={!href.trim() && !isEditing}
            >
              {isEditing ? "Update" : "Apply"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { buildRelString, type EditorLinkState };
