import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getProductionErrorMessage,
  getProductionValidationMessage,
  getSetupOwnerErrorMessage,
} from "@/lib/errors/user-facing";

const USER_FACING_SOURCE_FILES = [
  "src/app/login/page.tsx",
  "src/components/account/account-menu.tsx",
  "src/components/account/profile-settings-form.tsx",
  "src/components/editor/project-authors-manager.tsx",
  "src/components/editor/project-editor.tsx",
  "src/components/editor/project-files-manager.tsx",
  "src/components/editor/project-media-manager.tsx",
  "src/components/editor/project-members-settings.tsx",
  "src/components/editor/project-permissions-settings.tsx",
  "src/components/projects/project-creation-form.tsx",
  "src/components/projects/project-creation-hooks.ts",
  "src/hooks/post-editor-session/effects.ts",
  "src/hooks/use-post-editor-session.ts",
] as const;

describe("user-facing error messages", () => {
  it("replaces technical runtime errors with production-ready copy", () => {
    expect(
      getProductionErrorMessage(
        new Error("Authentication required."),
        "Could not load this project right now.",
      ),
    ).toBe("Please sign in to continue.");

    expect(
      getProductionErrorMessage(
        new Error(
          "Could not write basebuddy.config.json. The app process needs permission to update the BaseBuddy data config file.",
        ),
        "Could not create the project right now.",
      ),
    ).toBe(
      "We couldn't finish preparing this project. Check the setup permissions and try again.",
    );

    expect(
      getProductionErrorMessage(
        new Error("password authentication failed for user \"postgres\""),
        "We couldn't verify the database connection. Double-check the credentials and try again.",
      ),
    ).toBe("The app connection is no longer valid. Update setup and try again.");

    expect(
      getProductionErrorMessage(
        new Error("Could not upload directly to the configured storage. If this project uses S3-compatible storage, make sure its CORS settings allow this site."),
        "Could not upload that file right now.",
      ),
    ).toBe("We couldn't upload this file. Check media storage and try again.");
  });

  it("does not pass through raw provider, schema, or runtime terminology", () => {
    expect(
      getProductionErrorMessage(
        new Error("Mapped content requires Session Pooler access."),
        "Could not load this project right now.",
      ),
    ).toBe("This project needs a working database connection before you can continue.");

    expect(
      getProductionErrorMessage(
        new Error("Could not find the public.basebuddy_get_projects RPC in the schema cache."),
        "Could not load projects right now.",
      ),
    ).toBe("BaseBuddy setup needs attention. Open setup and run the checks.");

    expect(
      getProductionErrorMessage(
        new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY"),
        "Could not load this project right now.",
      ),
    ).toBe("BaseBuddy setup needs attention. Open setup and check the environment values.");

    expect(
      getProductionErrorMessage(
        new Error("Custom field meta_title is not safely editable with the current storage shape."),
        "Could not save the post right now.",
      ),
    ).toBe("This project's setup is out of date. Review the field setup and try again.");

    expect(
      getProductionErrorMessage(
        new Error("A mapped column does not exist in the connected database."),
        "Could not save the post right now.",
      ),
    ).toBe("This project's mapping is out of date. Review the mapping and try again.");

    expect(
      getProductionErrorMessage(
        new Error("MaxClientsInSessionMode: max clients reached"),
        "Could not load this project right now.",
      ),
    ).toBe("BaseBuddy is busy right now. Try again in a few seconds.");

    expect(
      getProductionErrorMessage(
        new Error("AccessDenied: Could not reach the configured S3-compatible storage"),
        "Could not upload that file right now.",
      ),
    ).toBe("We couldn't complete the storage request. Check media storage and try again.");
  });

  it("uses setup-owner copy when setup diagnostics need technical next steps", () => {
    expect(
      getSetupOwnerErrorMessage(
        new Error("Missing BaseBuddy data config file: basebuddy-data/basebuddy.config.json"),
        "Could not complete setup checks right now.",
      ),
    ).toBe("Open onboarding or run the BaseBuddy CLI setup command to create basebuddy-data/basebuddy.config.json.");

    expect(
      getSetupOwnerErrorMessage(
        new Error("Could not find the public.basebuddy_get_projects RPC in the schema cache."),
        "Could not complete setup checks right now.",
      ),
    ).toBe("BaseBuddy setup needs attention. Open setup and run the checks.");

    expect(
      getProductionErrorMessage(
        new Error("Missing BaseBuddy data config file: basebuddy-data/basebuddy.config.json"),
        "Could not load this project right now.",
      ),
    ).toBe("BaseBuddy setup needs attention. Open setup and check the BaseBuddy config.");
  });

  it("preserves self-host mapping guidance", () => {
    expect(
      getProductionErrorMessage(
        new Error("Finish database mapping before the editor can load content."),
        "Could not load this project right now.",
      ),
    ).toBe("Finish database mapping before the editor can load content.");
  });

  it("preserves clear production-ready messages", () => {
    expect(
      getProductionErrorMessage(
        new Error("Could not save the post right now."),
        "Could not load this project right now.",
      ),
    ).toBe("Could not save the post right now.");

    expect(
      getProductionErrorMessage(
        new Error("Enter a title before publishing."),
        "Could not save the post right now.",
      ),
    ).toBe("Enter a title before publishing.");

    expect(
      getProductionErrorMessage(
        new Error("Not authorized to invite project members"),
        "Could not manage project members right now.",
      ),
    ).toBe("Not authorized to invite project members");

    expect(
      getProductionErrorMessage(
        new Error("That email already has a pending invitation."),
        "Could not manage project members right now.",
      ),
    ).toBe("That email already has a pending invitation.");
  });

  it("collapses generic validation noise into cleaner user-facing copy", () => {
    expect(getProductionValidationMessage("Required")).toBe(
      "Some information is missing or invalid. Please review and try again.",
    );
    expect(getProductionValidationMessage("Invalid input")).toBe(
      "Some information is missing or invalid. Please review and try again.",
    );
    expect(getProductionValidationMessage("Enter a valid email address.")).toBe(
      "Enter a valid email address.",
    );
    expect(getProductionValidationMessage("Too many posts were selected.")).toBe(
      "Too many posts were selected.",
    );
    expect(getProductionValidationMessage("Name is required.")).toBe("Name is required.");
  });

  it("does not leave raw runtime error.message passthroughs in user-facing React code", () => {
    const repoRoot = process.cwd();
    const offenders = USER_FACING_SOURCE_FILES.flatMap((relativePath) => {
      const contents = readFileSync(join(repoRoot, relativePath), "utf8");
      return /error instanceof Error \? error\.message\s*:/g.test(contents) ? [relativePath] : [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps setup failure mappings out of raw install terminology", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "errors", "user-facing.ts"), "utf8");

    expect(source).not.toMatch(/CMS schema/i);
    expect(source).not.toMatch(/control-plane schema/i);
    expect(source).not.toMatch(/Supabase migrations/i);
    expect(source).not.toMatch(/install database/i);
    expect(source).not.toMatch(/database mapping/i);
    expect(source).not.toMatch(/configured storage/i);
    expect(source).not.toMatch(/S3-compatible/i);
    expect(source).not.toMatch(/app configuration/i);
    expect(source).not.toMatch(/upload storage/i);
  });

  it("keeps storage credential errors pointed at env values instead of app configuration", () => {
    const repoRoot = process.cwd();
    const sources = [
      "src/lib/content-runtime/client-direct-upload.ts",
      "src/lib/control-plane/server.ts",
      "src/lib/content-runtime/server-files-context.ts",
      "src/lib/content-runtime/server-media-shared.ts",
      "src/lib/content-runtime/server-media-supabase.ts",
      "src/lib/content-runtime/server-media-context.ts",
      "src/lib/content-runtime/server-project-mapping.ts",
      "src/components/editor/project-editor/posts-mapping-workspace.tsx",
    ].map((relativePath) => readFileSync(join(repoRoot, relativePath), "utf8"));

    expect(sources.join("\n")).not.toMatch(/app configuration/i);
    expect(sources.join("\n")).not.toMatch(/upload storage/i);
    expect(sources.join("\n")).toMatch(/environment values|env/i);
  });

  it("keeps editor field-state copy out of runtime implementation language", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "editor", "project-editor", "post-side-panel.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/storage shape/i);
    expect(source).not.toMatch(/helper rows?/i);
    expect(source).not.toMatch(/not safely editable/i);
  });

  it("keeps mapping setup screens away from internal runtime labels", () => {
    const repoRoot = process.cwd();
    const sources = [
      "src/components/editor/project-editor/collection-body.tsx",
      "src/components/editor/project-editor/mapping-draft-view.tsx",
      "src/components/editor/project-editor/settings-view.tsx",
      "src/components/editor/project-editor/posts-mapping-ui.tsx",
      "src/components/editor/project-editor/posts-mapping-wizard.tsx",
      "src/components/editor/project-editor/post-side-panel.tsx",
    ].map((relativePath) => readFileSync(join(repoRoot, relativePath), "utf8").replace(/import[\s\S]*?;\n/g, ""));

    expect(sources.join("\n")).not.toMatch(/content plane|content-plane|storage shape|Boolean mapping|mapped content setup|\bCMS\b/i);
  });
});
