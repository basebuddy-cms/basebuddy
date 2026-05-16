export type ProjectEditorShortcutId =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "link"
  | "clearFormatting"
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "numberedList"
  | "save"
  | "undo"
  | "redo"
  | "selectAll"
  | "showShortcuts"
  | "focusToolbar"
  | "newParagraph"
  | "softBreak"
  | "indentListItem"
  | "outdentListItem";

export type ProjectEditorShortcutDefinition = {
  action: string;
  group: "Editor" | "Structure" | "Text";
  id: ProjectEditorShortcutId;
  mac: string;
  windows: string;
};

export const PROJECT_EDITOR_SHORTCUTS: ProjectEditorShortcutDefinition[] = [
  { action: "Bold", group: "Text", id: "bold", mac: "Cmd+B", windows: "Ctrl+B" },
  { action: "Italic", group: "Text", id: "italic", mac: "Cmd+I", windows: "Ctrl+I" },
  { action: "Underline", group: "Text", id: "underline", mac: "Cmd+U", windows: "Ctrl+U" },
  {
    action: "Strikethrough",
    group: "Text",
    id: "strikethrough",
    mac: "Option+Shift+5",
    windows: "Alt+Shift+5",
  },
  { action: "Insert or edit link", group: "Text", id: "link", mac: "Cmd+K", windows: "Ctrl+K" },
  {
    action: "Clear formatting",
    group: "Text",
    id: "clearFormatting",
    mac: "Cmd+\\",
    windows: "Ctrl+\\",
  },
  {
    action: "Paragraph",
    group: "Structure",
    id: "paragraph",
    mac: "Cmd+Option+0",
    windows: "Alt+Shift+0",
  },
  {
    action: "Heading 1",
    group: "Structure",
    id: "heading1",
    mac: "Cmd+Option+1",
    windows: "Alt+Shift+1",
  },
  {
    action: "Heading 2",
    group: "Structure",
    id: "heading2",
    mac: "Cmd+Option+2",
    windows: "Alt+Shift+2",
  },
  {
    action: "Heading 3",
    group: "Structure",
    id: "heading3",
    mac: "Cmd+Option+3",
    windows: "Alt+Shift+3",
  },
  {
    action: "Bulleted list",
    group: "Structure",
    id: "bulletList",
    mac: "Cmd+Shift+8",
    windows: "Ctrl+Shift+8",
  },
  {
    action: "Numbered list",
    group: "Structure",
    id: "numberedList",
    mac: "Cmd+Shift+7",
    windows: "Ctrl+Shift+7",
  },
  { action: "Save", group: "Editor", id: "save", mac: "Cmd+S", windows: "Ctrl+S" },
  { action: "Undo", group: "Editor", id: "undo", mac: "Cmd+Z", windows: "Ctrl+Z" },
  { action: "Redo", group: "Editor", id: "redo", mac: "Cmd+Shift+Z", windows: "Ctrl+Y" },
  { action: "Select all", group: "Editor", id: "selectAll", mac: "Cmd+A", windows: "Ctrl+A" },
  {
    action: "Show shortcuts",
    group: "Editor",
    id: "showShortcuts",
    mac: "Cmd+/",
    windows: "Ctrl+/",
  },
  {
    action: "Focus toolbar",
    group: "Editor",
    id: "focusToolbar",
    mac: "Option+F10",
    windows: "Alt+F10",
  },
  { action: "New paragraph", group: "Editor", id: "newParagraph", mac: "Enter", windows: "Enter" },
  { action: "Soft line break", group: "Editor", id: "softBreak", mac: "Shift+Enter", windows: "Shift+Enter" },
  {
    action: "Indent list item (inside lists)",
    group: "Editor",
    id: "indentListItem",
    mac: "Tab",
    windows: "Tab",
  },
  {
    action: "Outdent list item (inside lists)",
    group: "Editor",
    id: "outdentListItem",
    mac: "Shift+Tab",
    windows: "Shift+Tab",
  },
];

const PROJECT_EDITOR_SHORTCUTS_BY_ID = Object.fromEntries(
  PROJECT_EDITOR_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]),
) as Record<ProjectEditorShortcutId, ProjectEditorShortcutDefinition>;

export const getProjectEditorKeyboardPlatform = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform = navigator.platform || navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
};

export const getProjectEditorShortcutLabel = (
  id: ProjectEditorShortcutId,
  isMacKeyboardPlatform: boolean,
) => {
  const shortcut = PROJECT_EDITOR_SHORTCUTS_BY_ID[id];
  return isMacKeyboardPlatform ? shortcut.mac : shortcut.windows;
};
