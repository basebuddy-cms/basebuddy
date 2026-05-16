import { describe, expect, it } from "vitest";

import {
  detectTimestampSourceHint,
  detectContentColumns,
  detectWorkflow,
} from "@/lib/content-runtime/introspection-support-shared";
import type { ContentIntrospectedTable } from "@/lib/content-runtime/introspection";

const createTable = (overrides: Partial<ContentIntrospectedTable> = {}): ContentIntrospectedTable => ({
  columns: [],
  foreignKeys: [],
  kind: "table",
  name: "posts",
  primaryKey: "id",
  rowCountEstimate: 1,
  sampleRows: [],
  schema: "public",
  ...overrides,
});

describe("Postgres introspection shared heuristics", () => {
  it("detects workflow from status and published_at columns", () => {
    const table = createTable({
      columns: [
        { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "status", udtName: "text" },
        { dataType: "timestamp with time zone", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "published_at", udtName: "timestamptz" },
      ],
      sampleRows: [{ id: "1", published_at: "2026-03-10T00:00:00Z", status: "published" }],
    });

    expect(detectWorkflow(table)).toEqual(
      expect.objectContaining({
        mode: "status",
        publishedAtColumn: "published_at",
        publishedValues: ["published"],
        statusColumn: "status",
      }),
    );
  });

  it("detects workflow from enum-backed status columns", () => {
    const table = createTable({
      columns: [
        { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
        {
          dataType: "USER-DEFINED",
          defaultValue: null,
          enumValues: ["draft", "review", "published"],
          isArray: false,
          isJson: false,
          isNullable: false,
          name: "publication_status",
          udtName: "post_status",
        },
        { dataType: "timestamp with time zone", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "published_at", udtName: "timestamptz" },
      ],
      sampleRows: [{ id: "1", publication_status: "published", published_at: "2026-03-10T00:00:00Z" }],
    });

    expect(detectWorkflow(table)).toEqual(
      expect.objectContaining({
        draftValues: ["draft", "review"],
        mode: "status",
        publishedAtColumn: "published_at",
        publishedValues: ["published"],
        statusColumn: "publication_status",
      }),
    );
  });

  it("detects ordered content fields with markdown and plain text hints", () => {
    const table = createTable({
      columns: [
        { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "intro", udtName: "text" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "steps_markdown", udtName: "text" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "outro", udtName: "text" },
      ],
      sampleRows: [
        {
          id: "1",
          intro: "Short intro",
          outro: "Final summary",
          steps_markdown: "## Step 1\n- Do thing",
        },
      ],
    });

    expect(detectContentColumns(table)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: "intro", kind: "plain_text" }),
        expect.objectContaining({ column: "steps_markdown", kind: "markdown" }),
        expect.objectContaining({ column: "outro", kind: "plain_text" }),
      ]),
    );
  });

  it("does not treat SEO metadata columns as editor content", () => {
    const table = createTable({
      columns: [
        { dataType: "uuid", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "id", udtName: "uuid" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: false, name: "title", udtName: "text" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "body_html", udtName: "text" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "meta_description", udtName: "text" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "seo_title", udtName: "text" },
        { dataType: "text", defaultValue: null, enumValues: null, isArray: false, isJson: false, isNullable: true, name: "focus_keyword", udtName: "text" },
      ],
      sampleRows: [
        {
          body_html: "<p>Main article body</p>",
          focus_keyword: "cms",
          id: "1",
          meta_description: "Short search snippet",
          seo_title: "Article title for search",
          title: "Article title",
        },
      ],
    });

    expect(detectContentColumns(table).map((field) => field.column)).toEqual(["body_html"]);
  });

  it("classifies unsafe timestamp sources from views, generated columns, triggers, and audit tables", () => {
    expect(
      detectTimestampSourceHint(
        createTable({
          columns: [
            {
              dataType: "timestamp with time zone",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: true,
              name: "published_at",
              udtName: "timestamptz",
            },
          ],
          kind: "view",
          name: "posts_view",
        }),
        "published_at",
      ),
    ).toBe("view_derived");

    expect(
      detectTimestampSourceHint(
        createTable({
          columns: [
            {
              dataType: "timestamp with time zone",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: true,
              isJson: false,
              isNullable: false,
              name: "created_at",
              udtName: "timestamptz",
            },
          ],
        }),
        "created_at",
      ),
    ).toBe("generated");

    expect(
      detectTimestampSourceHint(
        createTable({
          columns: [
            {
              dataType: "timestamp with time zone",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: true,
              name: "updated_at",
              udtName: "timestamptz",
            },
          ],
          triggerDefinitions: [
            "CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at')",
          ],
        }),
        "updated_at",
      ),
    ).toBe("trigger_managed");

    expect(
      detectTimestampSourceHint(
        createTable({
          columns: [
            {
              dataType: "timestamp with time zone",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isJson: false,
              isNullable: true,
              name: "logged_at",
              udtName: "timestamptz",
            },
          ],
          name: "post_audit_events",
        }),
        "logged_at",
      ),
    ).toBe("audit_derived");
  });
});
