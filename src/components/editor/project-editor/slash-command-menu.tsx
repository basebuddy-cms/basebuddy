"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { createPortal } from "react-dom";

import type { ProjectEditorSlashCommandItem } from "@/components/editor/project-editor/slash-commands";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type ProjectEditorSlashCommandMenuProps = {
  editor: TiptapEditor | null;
  items: ProjectEditorSlashCommandItem[];
  onSelect: (item: ProjectEditorSlashCommandItem) => void;
  open: boolean;
  selectedIndex: number;
};

type SlashCommandMenuPosition = {
  left: number;
  top: number;
};

export function ProjectEditorSlashCommandMenu({
  editor,
  items,
  onSelect,
  open,
  selectedIndex,
}: ProjectEditorSlashCommandMenuProps) {
  const [position, setPosition] = useState<SlashCommandMenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!editor || !open || typeof window === "undefined") {
      setPosition(null);
      return;
    }

    try {
      const cursorCoords = editor.view.coordsAtPos(editor.state.selection.from);
      const menuWidth = 280;
      const nextLeft = Math.min(
        Math.max(cursorCoords.left, 16),
        Math.max(window.innerWidth - menuWidth - 16, 16),
      );

      setPosition({
        left: nextLeft,
        top: cursorCoords.bottom + 10,
      });
    } catch {
      setPosition(null);
    }
  }, [editor, open]);

  useLayoutEffect(() => {
    updatePosition();
  }, [items.length, open, selectedIndex, updatePosition]);

  useEffect(() => {
    if (!editor || !open) {
      return;
    }

    const handleWindowUpdate = () => updatePosition();

    editor.on("selectionUpdate", updatePosition);
    editor.on("transaction", updatePosition);
    window.addEventListener("resize", handleWindowUpdate);
    window.addEventListener("scroll", handleWindowUpdate, true);

    return () => {
      editor.off("selectionUpdate", updatePosition);
      editor.off("transaction", updatePosition);
      window.removeEventListener("resize", handleWindowUpdate);
      window.removeEventListener("scroll", handleWindowUpdate, true);
    };
  }, [editor, open, updatePosition]);

  if (!editor || !open || !position || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed z-40"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
    >
      <div className="w-[280px] overflow-hidden rounded-lg border border-border/70 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <Command shouldFilter={false} value={items[selectedIndex]?.id}>
          {items.length ? (
            <CommandList className="max-h-[320px] p-1">
              {items.map((item, index) => {
                const Icon = item.icon;

                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onSelect={() => onSelect(item)}
                    className={cn(
                      "gap-3 rounded-lg px-3 py-2.5 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                      index === selectedIndex ? "bg-accent text-accent-foreground" : "text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        index === selectedIndex ? "text-accent-foreground" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandList>
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">No matching commands</div>
          )}
        </Command>
      </div>
    </div>,
    document.body,
  );
}
