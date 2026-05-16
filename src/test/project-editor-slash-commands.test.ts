import { describe, expect, it } from "vitest";

import {
  filterProjectEditorSlashCommands,
  PROJECT_EDITOR_SLASH_COMMANDS,
} from "@/components/editor/project-editor/slash-commands";

describe("project editor slash commands", () => {
  it("covers the full editor formatting and insert feature set", () => {
    const commandIds = PROJECT_EDITOR_SLASH_COMMANDS.map((command) => command.id);

    expect(commandIds).toEqual(
      expect.arrayContaining([
        "paragraph",
        "heading1",
        "heading2",
        "heading3",
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "clearFormatting",
        "bulletList",
        "numberedList",
        "quote",
        "codeBlock",
        "alignLeft",
        "alignCenter",
        "alignRight",
        "link",
        "image",
        "divider",
      ]),
    );
  });

  it("filters commands by label and keyword", () => {
    expect(
      filterProjectEditorSlashCommands(PROJECT_EDITOR_SLASH_COMMANDS, "head").map(
        (command) => command.id,
      ),
    ).toEqual(["heading1", "heading2", "heading3"]);

    expect(
      filterProjectEditorSlashCommands(PROJECT_EDITOR_SLASH_COMMANDS, "separator").map(
        (command) => command.id,
      ),
    ).toEqual(["divider"]);
  });

  it("returns obvious prefix matches first for short slash queries", () => {
    const rankedCommandIds = filterProjectEditorSlashCommands(
      PROJECT_EDITOR_SLASH_COMMANDS,
      "b",
    ).map((command) => command.id);

    expect(rankedCommandIds.slice(0, 3)).toEqual(["bold", "bulletList", "codeBlock"]);
    expect(rankedCommandIds).not.toContain("paragraph");
  });
});
