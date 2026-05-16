import type { Editor as TiptapEditor } from "@tiptap/core";

export type ProjectEditorSlashCommandMatch = {
  from: number;
  query: string;
  to: number;
};

export const getProjectEditorSlashCommandMatch = (
  currentEditor: TiptapEditor | null,
): ProjectEditorSlashCommandMatch | null => {
  if (!currentEditor) {
    return null;
  }

  const { from, to, empty, $from } = currentEditor.state.selection;

  if (!empty || from !== to) {
    return null;
  }

  const parent = $from.parent;

  if (!parent.isTextblock || parent.type.name === "codeBlock") {
    return null;
  }

  const fullText = parent.textBetween(0, parent.content.size, "\0", "\0");
  const textBeforeCursor = parent.textBetween(0, $from.parentOffset, "\0", "\0");
  const slashQueryMatch = textBeforeCursor.match(/^\/([^\s]*)$/);

  if (!slashQueryMatch || textBeforeCursor.length !== fullText.length) {
    return null;
  }

  const blockStart = $from.start();

  return {
    from: blockStart,
    query: slashQueryMatch[1] ?? "",
    to: blockStart + textBeforeCursor.length,
  };
};
