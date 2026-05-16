import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Text,
  Underline,
} from "lucide-react";

export type ProjectEditorSlashCommandId =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "clearFormatting"
  | "bulletList"
  | "numberedList"
  | "quote"
  | "codeBlock"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "link"
  | "image"
  | "file"
  | "divider";

export type ProjectEditorSlashCommandDefinition = {
  defaultOrder: number;
  icon: LucideIcon;
  id: ProjectEditorSlashCommandId;
  kind: "block" | "inline" | "insert";
  keywords: string[];
  label: string;
};

export type ProjectEditorSlashCommandItem = ProjectEditorSlashCommandDefinition & {
  run: () => void;
};

export const PROJECT_EDITOR_SLASH_COMMANDS: ProjectEditorSlashCommandDefinition[] = [
  {
    defaultOrder: 0,
    icon: Text,
    id: "paragraph",
    kind: "block",
    keywords: ["text", "normal"],
    label: "Paragraph",
  },
  {
    defaultOrder: 1,
    icon: Heading1,
    id: "heading1",
    kind: "block",
    keywords: ["title", "h1"],
    label: "Heading 1",
  },
  {
    defaultOrder: 2,
    icon: Heading2,
    id: "heading2",
    kind: "block",
    keywords: ["subtitle", "h2"],
    label: "Heading 2",
  },
  {
    defaultOrder: 3,
    icon: Heading3,
    id: "heading3",
    kind: "block",
    keywords: ["section", "h3"],
    label: "Heading 3",
  },
  {
    defaultOrder: 4,
    icon: List,
    id: "bulletList",
    kind: "block",
    keywords: ["unordered", "ul", "list"],
    label: "Bullet list",
  },
  {
    defaultOrder: 5,
    icon: ListOrdered,
    id: "numberedList",
    kind: "block",
    keywords: ["ordered", "ol", "list"],
    label: "Numbered list",
  },
  {
    defaultOrder: 6,
    icon: Quote,
    id: "quote",
    kind: "block",
    keywords: ["blockquote", "citation"],
    label: "Quote",
  },
  {
    defaultOrder: 7,
    icon: Code,
    id: "codeBlock",
    kind: "block",
    keywords: ["code", "snippet"],
    label: "Code block",
  },
  {
    defaultOrder: 8,
    icon: Minus,
    id: "divider",
    kind: "block",
    keywords: ["hr", "horizontal rule", "separator"],
    label: "Divider",
  },
  {
    defaultOrder: 9,
    icon: AlignLeft,
    id: "alignLeft",
    kind: "block",
    keywords: ["left", "alignment"],
    label: "Align left",
  },
  {
    defaultOrder: 10,
    icon: AlignCenter,
    id: "alignCenter",
    kind: "block",
    keywords: ["center", "middle", "alignment"],
    label: "Align center",
  },
  {
    defaultOrder: 11,
    icon: AlignRight,
    id: "alignRight",
    kind: "block",
    keywords: ["right", "alignment"],
    label: "Align right",
  },
  {
    defaultOrder: 12,
    icon: Link,
    id: "link",
    kind: "insert",
    keywords: ["url", "hyperlink"],
    label: "Link",
  },
  {
    defaultOrder: 13,
    icon: Image,
    id: "image",
    kind: "insert",
    keywords: ["photo", "media"],
    label: "Image",
  },
  {
    defaultOrder: 14,
    icon: FileText,
    id: "file",
    kind: "insert",
    keywords: ["document", "download", "attachment"],
    label: "File",
  },
  {
    defaultOrder: 15,
    icon: Bold,
    id: "bold",
    kind: "inline",
    keywords: ["strong"],
    label: "Bold",
  },
  {
    defaultOrder: 16,
    icon: Italic,
    id: "italic",
    kind: "inline",
    keywords: ["emphasis"],
    label: "Italic",
  },
  {
    defaultOrder: 17,
    icon: Underline,
    id: "underline",
    kind: "inline",
    keywords: ["line"],
    label: "Underline",
  },
  {
    defaultOrder: 18,
    icon: Strikethrough,
    id: "strikethrough",
    kind: "inline",
    keywords: ["strike"],
    label: "Strikethrough",
  },
  {
    defaultOrder: 19,
    icon: Eraser,
    id: "clearFormatting",
    kind: "inline",
    keywords: ["reset", "remove formatting", "plain text"],
    label: "Clear formatting",
  },
];

type ProjectEditorSlashCommandMatch = {
  characterIndex: number;
  matchedValueLength: number;
  sourceIndex: number;
  tier: number;
};

const getProjectEditorSlashCommandMatch = (
  command: Pick<ProjectEditorSlashCommandDefinition, "keywords" | "label">,
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  const label = command.label.toLowerCase();
  const labelWords = label.split(/[\s-]+/).filter(Boolean);

  if (label === normalizedQuery) {
    return { characterIndex: 0, matchedValueLength: label.length, sourceIndex: 0, tier: 0 } satisfies ProjectEditorSlashCommandMatch;
  }

  if (label.startsWith(normalizedQuery)) {
    return { characterIndex: 0, matchedValueLength: label.length, sourceIndex: 0, tier: 1 } satisfies ProjectEditorSlashCommandMatch;
  }

  if (labelWords.some((word) => word.startsWith(normalizedQuery))) {
    return { characterIndex: 0, matchedValueLength: label.length, sourceIndex: 0, tier: 2 } satisfies ProjectEditorSlashCommandMatch;
  }

  for (const [index, keyword] of command.keywords.entries()) {
    const normalizedKeyword = keyword.toLowerCase();
    const keywordWords = normalizedKeyword.split(/[\s-]+/).filter(Boolean);

    if (normalizedKeyword === normalizedQuery) {
      return {
        characterIndex: 0,
        matchedValueLength: normalizedKeyword.length,
        sourceIndex: index,
        tier: 3,
      } satisfies ProjectEditorSlashCommandMatch;
    }

    if (normalizedKeyword.startsWith(normalizedQuery)) {
      return {
        characterIndex: 0,
        matchedValueLength: normalizedKeyword.length,
        sourceIndex: index,
        tier: 4,
      } satisfies ProjectEditorSlashCommandMatch;
    }

    if (keywordWords.some((word) => word.startsWith(normalizedQuery))) {
      return {
        characterIndex: 0,
        matchedValueLength: normalizedKeyword.length,
        sourceIndex: index,
        tier: 5,
      } satisfies ProjectEditorSlashCommandMatch;
    }
  }

  const labelContainsIndex = label.indexOf(normalizedQuery);

  if (labelContainsIndex >= 0) {
    return {
      characterIndex: labelContainsIndex,
      matchedValueLength: label.length,
      sourceIndex: 0,
      tier: 6,
    } satisfies ProjectEditorSlashCommandMatch;
  }

  for (const [index, keyword] of command.keywords.entries()) {
    const normalizedKeyword = keyword.toLowerCase();
    const keywordContainsIndex = normalizedKeyword.indexOf(normalizedQuery);

    if (keywordContainsIndex >= 0) {
      return {
        characterIndex: keywordContainsIndex,
        matchedValueLength: normalizedKeyword.length,
        sourceIndex: index,
        tier: 7,
      } satisfies ProjectEditorSlashCommandMatch;
    }
  }

  return null;
};

export const filterProjectEditorSlashCommands = <
  T extends Pick<ProjectEditorSlashCommandDefinition, "defaultOrder" | "keywords" | "label">,
>(
  commands: T[],
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [...commands].sort((left, right) => left.defaultOrder - right.defaultOrder);
  }

  return commands
    .map((command) => {
      const match = getProjectEditorSlashCommandMatch(command, normalizedQuery);

      if (!match) {
        return null;
      }

      return {
        command,
        match,
      };
    })
    .filter((entry): entry is { command: T; match: ProjectEditorSlashCommandMatch } => entry !== null)
    .sort(
      (left, right) =>
        left.match.tier - right.match.tier ||
        left.match.characterIndex - right.match.characterIndex ||
        left.match.matchedValueLength - right.match.matchedValueLength ||
        left.match.sourceIndex - right.match.sourceIndex ||
        left.command.defaultOrder - right.command.defaultOrder,
    )
    .map((entry) => entry.command);
};
