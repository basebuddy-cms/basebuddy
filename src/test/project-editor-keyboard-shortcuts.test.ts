import { describe, expect, it } from "vitest";

import {
  PROJECT_EDITOR_SHORTCUTS,
  getProjectEditorShortcutLabel,
} from "@/components/editor/project-editor/keyboard-shortcuts";

describe("project editor keyboard shortcuts", () => {
  it("includes paragraph and heading shortcuts", () => {
    const shortcutIds = PROJECT_EDITOR_SHORTCUTS.map((shortcut) => shortcut.id);

    expect(shortcutIds).toEqual(
      expect.arrayContaining(["paragraph", "heading1", "heading2", "heading3"]),
    );
  });

  it("returns platform-aware labels", () => {
    expect(getProjectEditorShortcutLabel("paragraph", true)).toBe("Cmd+Option+0");
    expect(getProjectEditorShortcutLabel("paragraph", false)).toBe("Alt+Shift+0");
    expect(getProjectEditorShortcutLabel("save", true)).toBe("Cmd+S");
    expect(getProjectEditorShortcutLabel("save", false)).toBe("Ctrl+S");
  });
});
