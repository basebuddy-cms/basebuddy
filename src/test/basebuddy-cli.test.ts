import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createDefaultBaseBuddyConfig } from "@/lib/basebuddy-config/schema";
import { getBaseBuddyConfigPath } from "@/lib/basebuddy-config/paths";
import { runBaseBuddyCli } from "../../scripts/basebuddy-cli";

const fixedNow = "2026-05-27T00:00:00.000Z";
const authSecret = "local-auth-secret-value-with-32-plus-chars";
const databaseUrl = "postgresql://content-user:db-pass@example.com:5432/postgres";

const readSavedConfig = async () =>
  JSON.parse(await readFile(getBaseBuddyConfigPath(), "utf8"));

describe("basebuddy CLI", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  const runCli = async (
    args: string[],
    options: {
      introspectContentSchema?: Parameters<typeof runBaseBuddyCli>[1]["introspectContentSchema"];
      queryDatabase?: (connectionString: string) => Promise<void>;
    } = {},
  ) => {
    let stdout = "";
    let stderr = "";
    const exitCode = await runBaseBuddyCli(args, {
      introspectContentSchema: options.introspectContentSchema,
      now: () => fixedNow,
      queryDatabase: options.queryDatabase,
      stderr: (chunk) => {
        stderr += chunk;
      },
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    return {
      exitCode,
      stderr,
      stdout,
      output: `${stdout}${stderr}`,
    };
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "basebuddy-cli-"));
    process.chdir(tempDir);
    await mkdir(join(process.cwd(), "basebuddy-data"), { recursive: true });
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("doctor exits non-zero for a missing basebuddy-data config without creating another path", async () => {
    const result = await runCli(["doctor"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(
      join(process.cwd(), "basebuddy-data", "basebuddy.config.json"),
    );
    expect(result.output).not.toContain(".basebuddy");
    expect(result.output).not.toContain("BASEBUDDY_DATA_DIR");
    expect(existsSync(getBaseBuddyConfigPath())).toBe(false);
    expect(existsSync(join(tempDir, "basebuddy.config.json"))).toBe(false);
    expect(existsSync(join(tempDir, ".basebuddy"))).toBe(false);
  });

  it("setup help is inspectable and does not create config", async () => {
    const result = await runCli(["setup", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm basebuddy setup");
    expect(result.stdout).toContain("BASEBUDDY_AUTH_SECRET");
    expect(result.stdout).toContain("BASEBUDDY_CONTENT_DATABASE_URL");
    expect(result.stdout).toContain("--owner-password <value>");
    expect(result.stdout).not.toMatch(/hash/i);
    expect(existsSync(getBaseBuddyConfigPath())).toBe(false);
  });

  it("main help only lists available commands", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("doctor");
    expect(result.stdout).toContain("setup");
    expect(result.stdout).toContain("user:create");
    expect(result.stdout).toContain("projects:create");
    expect(result.stdout).toContain("mapping:set");
  });

  it("setup creates only process.cwd()/basebuddy-data/basebuddy.config.json without storing env secrets", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);

    const result = await runCli(["setup"]);
    const config = await readSavedConfig();
    const serializedConfig = JSON.stringify(config);

    expect(result.exitCode).toBe(0);
    expect(config.install.content).toEqual({ provider: "postgres" });
    expect(serializedConfig).not.toContain(authSecret);
    expect(serializedConfig).not.toContain("db-pass");
    expect(serializedConfig).not.toContain("databaseUrl");
    expect(serializedConfig).not.toContain("authSecret");
    expect(result.output).toContain(
      join(process.cwd(), "basebuddy-data", "basebuddy.config.json"),
    );
    expect(result.output).not.toContain(authSecret);
    expect(result.output).not.toContain("db-pass");
    expect(existsSync(join(tempDir, "basebuddy.config.json"))).toBe(false);
    expect(existsSync(join(tempDir, ".basebuddy"))).toBe(false);
  });

  it("setup can create the first owner in the same BaseBuddy data config file and checks database reachability", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);
    const queryDatabase = vi.fn().mockResolvedValue(undefined);

    const result = await runCli([
      "setup",
      "--owner-email",
      "owner@example.com",
      "--owner-name",
      "Owner User",
      "--owner-password",
      "PlainPass1!",
    ], {
      queryDatabase,
    });
    const config = await readSavedConfig();

    expect(result.exitCode).toBe(0);
    expect(queryDatabase).toHaveBeenCalledWith(databaseUrl);
    expect(result.output).toContain("Ready: yes");
    expect(JSON.stringify(config)).not.toContain(authSecret);
    expect(JSON.stringify(config)).not.toContain("db-pass");
    expect(config.users).toHaveLength(1);
    expect(config.users[0]).toMatchObject({
      email: "owner@example.com",
      name: "Owner User",
      passwordHashParams: {
        keyLength: 64,
        name: "scrypt",
      },
    });
    expect(JSON.stringify(config)).not.toContain("PlainPass1!");
    expect(result.output).not.toContain("PlainPass1!");
    expect(existsSync(join(tempDir, ".basebuddy"))).toBe(false);
  });

  it("user:create writes a hashed local user and never prints the password", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);

    await runCli(["setup"]);

    const result = await runCli([
      "user:create",
      "--email",
      "owner@example.com",
      "--name",
      "Owner User",
      "--password",
      "PlainPass1!",
    ]);
    const config = await readSavedConfig();

    expect(result.exitCode).toBe(0);
    expect(config.users).toHaveLength(1);
    expect(config.users[0]).toMatchObject({
      avatarUrl: null,
      email: "owner@example.com",
      name: "Owner User",
      passwordHashParams: {
        keyLength: 64,
        name: "scrypt",
      },
    });
    expect(config.users[0].passwordHash).not.toBe("PlainPass1!");
    expect(JSON.stringify(config)).not.toContain("PlainPass1!");
    expect(result.output).not.toContain("PlainPass1!");
    expect(result.output).toContain("Password: stored securely");
    expect(result.output).not.toMatch(/scrypt hash/i);
  });

  it("doctor exits zero for ready config and prints redacted JSON", async () => {
    vi.stubEnv("BASEBUDDY_AUTH_SECRET", authSecret);
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);

    await runCli(["setup"]);
    await runCli([
      "user:create",
      "--email",
      "owner@example.com",
      "--name",
      "Owner User",
      "--password",
      "PlainPass1!",
    ]);
    const queryDatabase = vi.fn().mockResolvedValue(undefined);

    const result = await runCli(["doctor", "--json"], {
      queryDatabase,
    });
    const body = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(body.ready).toBe(true);
    expect(queryDatabase).toHaveBeenCalledWith(databaseUrl);
    expect(result.output).not.toContain(authSecret);
    expect(result.output).not.toContain("db-pass");
    expect(result.output).not.toContain("PlainPass1!");
    expect(result.output).toContain("set:");
  });

  it("doctor exits non-zero for invalid config without a raw stack trace", async () => {
    await writeFile(getBaseBuddyConfigPath(), "{not-json", "utf8");

    const result = await runCli(["doctor", "--json"]);
    const body = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(body.ready).toBe(false);
    expect(JSON.stringify(body)).toContain("Could not parse BaseBuddy config file");
    expect(result.output).not.toContain("SyntaxError");
  });

  it("supports project lifecycle commands through the config APIs", async () => {
    await writeFile(
      getBaseBuddyConfigPath(),
      `${JSON.stringify(createDefaultBaseBuddyConfig({ now: fixedNow }), null, 2)}\n`,
      "utf8",
    );
    await runCli([
      "user:create",
      "--email",
      "owner@example.com",
      "--name",
      "Owner User",
      "--password",
      "PlainPass1!",
    ]);

    const createResult = await runCli([
      "projects:create",
      "--actor-email",
      "owner@example.com",
      "--name",
      "Docs",
      "--slug",
      "docs",
      "--json",
    ]);
    const createdBody = JSON.parse(createResult.stdout);

    expect(createResult.exitCode).toBe(0);
    expect(createdBody.project).toMatchObject({
      name: "Docs",
      role: "owner",
      slug: "docs",
    });

    const listResult = await runCli([
      "projects:list",
      "--actor-email",
      "owner@example.com",
      "--json",
    ]);
    const listBody = JSON.parse(listResult.stdout);

    expect(listResult.exitCode).toBe(0);
    expect(listBody.projects).toHaveLength(1);
    expect(listBody.projects[0].slug).toBe("docs");

    const updateResult = await runCli([
      "projects:update",
      "--project",
      "docs",
      "--name",
      "Docs Hub",
      "--slug",
      "docs-hub",
      "--website-url",
      "https://docs.example.com",
      "--json",
    ]);
    const updateBody = JSON.parse(updateResult.stdout);

    expect(updateResult.exitCode).toBe(0);
    expect(updateBody.project).toMatchObject({
      name: "Docs Hub",
      slug: "docs-hub",
      websiteUrl: "https://docs.example.com",
    });

    const deleteResult = await runCli([
      "projects:delete",
      "--project",
      "docs-hub",
      "--json",
    ]);
    const deleteBody = JSON.parse(deleteResult.stdout);
    const config = await readSavedConfig();

    expect(deleteResult.exitCode).toBe(0);
    expect(deleteBody.deletedProject.slug).toBe("docs-hub");
    expect(config.projects).toHaveLength(0);
  });

  it("supports members, permissions, and invitations with actor checks", async () => {
    await writeFile(
      getBaseBuddyConfigPath(),
      `${JSON.stringify(createDefaultBaseBuddyConfig({ now: fixedNow }), null, 2)}\n`,
      "utf8",
    );
    await runCli([
      "user:create",
      "--email",
      "owner@example.com",
      "--name",
      "Owner User",
      "--password",
      "PlainPass1!",
    ]);
    await runCli([
      "user:create",
      "--email",
      "editor@example.com",
      "--name",
      "Editor User",
      "--password",
      "PlainPass1!",
    ]);
    await runCli([
      "projects:create",
      "--actor-email",
      "owner@example.com",
      "--name",
      "Docs",
      "--slug",
      "docs",
    ]);

    const addResult = await runCli([
      "members:add",
      "--project",
      "docs",
      "--actor-email",
      "owner@example.com",
      "--email",
      "editor@example.com",
      "--roles",
      "editor",
      "--json",
    ]);

    expect(addResult.exitCode).toBe(0);

    const permissionsResult = await runCli([
      "permissions:set",
      "--project",
      "docs",
      "--actor-email",
      "owner@example.com",
      "--user-email",
      "editor@example.com",
      "--allow",
      "mapping.write",
      "--deny",
      "project.delete",
      "--json",
    ]);
    const permissionsBody = JSON.parse(permissionsResult.stdout);

    expect(permissionsResult.exitCode).toBe(0);
    expect(permissionsBody.member.allowPermissionKeys).toContain("mapping.write");
    expect(permissionsBody.member.denyPermissionKeys).toContain("project.delete");

    const inviteResult = await runCli([
      "invites:create",
      "--project",
      "docs",
      "--actor-email",
      "owner@example.com",
      "--email",
      "viewer@example.com",
      "--roles",
      "viewer",
      "--json",
    ]);
    const inviteBody = JSON.parse(inviteResult.stdout);

    expect(inviteResult.exitCode).toBe(0);
    expect(inviteBody.invitation.invitePath).toMatch(/^\/invite\//);

    const revokeResult = await runCli([
      "invites:revoke",
      "--project",
      "docs",
      "--actor-email",
      "owner@example.com",
      "--invitation-id",
      inviteBody.invitation.invitationId,
      "--json",
    ]);

    expect(revokeResult.exitCode).toBe(0);
  });

  it("supports mapping and sidebar JSON updates from files", async () => {
    await writeFile(
      getBaseBuddyConfigPath(),
      `${JSON.stringify(createDefaultBaseBuddyConfig({ now: fixedNow }), null, 2)}\n`,
      "utf8",
    );
    await runCli([
      "user:create",
      "--email",
      "owner@example.com",
      "--name",
      "Owner User",
      "--password",
      "PlainPass1!",
    ]);
    await runCli([
      "projects:create",
      "--actor-email",
      "owner@example.com",
      "--name",
      "Docs",
      "--slug",
      "docs",
    ]);
    const mappingPath = join(tempDir, "mapping.json");
    const sidebarPath = join(tempDir, "sidebar.json");
    await writeFile(
      mappingPath,
      JSON.stringify({
        entities: {
          posts: {
            source: {
              kind: "table",
              primaryKey: "id",
              schema: "public",
              table: "posts",
            },
            status: "mapped",
          },
        },
      }),
      "utf8",
    );
    await writeFile(
      sidebarPath,
      JSON.stringify({
        pages: [
          {
            id: "main",
            label: "Main",
            items: [],
          },
        ],
      }),
      "utf8",
    );

    const mappingSetResult = await runCli([
      "mapping:set",
      "--project",
      "docs",
      "--input",
      mappingPath,
      "--binding-status",
      "ready",
      "--json",
    ]);
    const mappingSetBody = JSON.parse(mappingSetResult.stdout);

    expect(mappingSetResult.exitCode).toBe(0);
    expect(mappingSetBody.mapping.bindingStatus).toBe("ready");

    const mappingGetResult = await runCli([
      "mapping:get",
      "--project",
      "docs",
      "--json",
    ]);
    const mappingGetBody = JSON.parse(mappingGetResult.stdout);

    expect(mappingGetResult.exitCode).toBe(0);
    expect(mappingGetBody.mapping.bindingStatus).toBe("ready");

    const sidebarSetResult = await runCli([
      "sidebar:set",
      "--project",
      "docs",
      "--input",
      sidebarPath,
      "--json",
    ]);

    expect(sidebarSetResult.exitCode).toBe(0);

    const sidebarResetResult = await runCli([
      "sidebar:reset",
      "--project",
      "docs",
      "--json",
    ]);

    expect(sidebarResetResult.exitCode).toBe(0);
  });

  it("inspects database schema for agent-readable mapping work without printing secrets", async () => {
    vi.stubEnv("BASEBUDDY_CONTENT_DATABASE_URL", databaseUrl);
    const introspectContentSchema = vi.fn().mockResolvedValue({
      tables: [
        {
          columns: [
            {
              dataType: "uuid",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: false,
              isNullable: false,
              name: "id",
              udtName: "uuid",
            },
            {
              dataType: "text",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: false,
              isNullable: false,
              name: "title",
              udtName: "text",
            },
          ],
          foreignKeys: [],
          kind: "table",
          name: "pages",
          primaryKey: "id",
          rowCountEstimate: 2,
          sampleRows: [{ id: "page-1", title: "Home" }],
          schema: "public",
        },
      ],
    });

    const result = await runCli([
      "schema:inspect",
      "--schema",
      "public",
      "--table",
      "pages",
      "--json",
    ], {
      introspectContentSchema,
    });
    const body = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(introspectContentSchema).toHaveBeenCalledWith({
      includeSamples: true,
      schema: "public",
      tableRefs: ["public.pages"],
    });
    expect(body.tables[0]).toMatchObject({
      name: "pages",
      primaryKey: "id",
      schema: "public",
    });
    expect(result.output).not.toContain("db-pass");
  });

  it("drafts a valid mapping from inspected schema and agent hints", async () => {
    const schema = {
      tables: [
        {
          columns: [
            {
              dataType: "uuid",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: false,
              isNullable: false,
              name: "id",
              udtName: "uuid",
            },
            {
              dataType: "text",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: false,
              isNullable: false,
              name: "headline",
              udtName: "text",
            },
            {
              dataType: "text",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: false,
              isNullable: true,
              name: "slug",
              udtName: "text",
            },
            {
              dataType: "text",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: false,
              isNullable: true,
              name: "body_md",
              udtName: "text",
            },
            {
              dataType: "jsonb",
              defaultValue: null,
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: true,
              isNullable: true,
              name: "faq_json",
              udtName: "jsonb",
            },
            {
              dataType: "boolean",
              defaultValue: "false",
              enumValues: null,
              isArray: false,
              isGenerated: false,
              isJson: false,
              isNullable: false,
              name: "is_published",
              udtName: "bool",
            },
          ],
          foreignKeys: [],
          kind: "table",
          name: "pages",
          primaryKey: "id",
          rowCountEstimate: 3,
          sampleRows: [{ body_md: "# Home", faq_json: [{ question: "Q" }], headline: "Home", id: "page-1" }],
          schema: "public",
        },
      ],
    };
    const hintsPath = join(tempDir, "mapping-hints.json");
    await writeFile(
      hintsPath,
      JSON.stringify({
        postsTable: "public.pages",
        titleColumn: "headline",
        slugColumn: "slug",
        contentFields: [
          {
            column: "body_md",
            kind: "markdown",
            label: "Body",
          },
        ],
        customFields: [
          {
            column: "faq_json",
            kind: "json",
            label: "FAQ",
          },
        ],
        workflow: {
          mode: "published_flag",
          publishedFlagColumn: "is_published",
        },
      }),
      "utf8",
    );

    const result = await runCli([
      "mapping:draft",
      "--schema",
      "public",
      "--table",
      "pages",
      "--hints",
      hintsPath,
      "--json",
    ], {
      introspectContentSchema: vi.fn().mockResolvedValue(schema),
    });
    const body = JSON.parse(result.stdout);
    const posts = body.mappingConfig.entities.posts;

    expect(result.exitCode).toBe(0);
    expect(body.valid).toBe(true);
    expect(posts.source).toMatchObject({
      primaryKey: "id",
      schema: "public",
      table: "pages",
    });
    expect(posts.fields.title.column).toBe("headline");
    expect(posts.editorFields).toEqual([
      expect.objectContaining({
        column: "body_md",
        kind: "markdown",
        label: "Body",
      }),
    ]);
    expect(posts.customFields).toEqual([
      expect.objectContaining({
        column: "faq_json",
        kind: "json",
        label: "FAQ",
      }),
    ]);
    expect(posts.workflow).toMatchObject({
      mode: "published_flag",
      publishedFlagColumn: "is_published",
    });
  });

  it("explains mapping JSON so agents can verify before applying it", async () => {
    const mappingPath = join(tempDir, "mapping.json");
    await writeFile(
      mappingPath,
      JSON.stringify({
        entities: {
          posts: {
            editorFields: [
              {
                column: "body_md",
                id: "body",
                kind: "markdown",
                label: "Body",
                placeholder: null,
                required: false,
                visible: true,
              },
            ],
            source: {
              kind: "table",
              primaryKey: "id",
              schema: "public",
              table: "pages",
            },
            status: "mapped",
          },
        },
      }),
      "utf8",
    );

    const result = await runCli([
      "mapping:explain",
      "--input",
      mappingPath,
      "--json",
    ]);
    const body = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(body.summary.entities.posts).toMatchObject({
      editorFieldCount: 1,
      source: "public.pages",
      status: "mapped",
    });
  });

  it("prints an agent-first CLI setup workflow", async () => {
    const result = await runCli(["agent:setup", "--json"]);
    const body = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(body.workflow.map((step: { command: string }) => step.command)).toEqual([
      "pnpm basebuddy doctor",
      "pnpm basebuddy setup",
      "pnpm basebuddy projects:create",
      "pnpm basebuddy schema:inspect",
      "pnpm basebuddy mapping:draft",
      "pnpm basebuddy mapping:explain",
      "pnpm basebuddy mapping:set",
      "pnpm basebuddy sidebar:set",
      "pnpm basebuddy storage:set",
    ]);
  });

  it("supports non-secret media and file storage mapping commands", async () => {
    await writeFile(
      getBaseBuddyConfigPath(),
      `${JSON.stringify(createDefaultBaseBuddyConfig({ now: fixedNow }), null, 2)}\n`,
      "utf8",
    );
    await runCli([
      "user:create",
      "--email",
      "owner@example.com",
      "--name",
      "Owner User",
      "--password",
      "PlainPass1!",
    ]);
    await runCli([
      "projects:create",
      "--actor-email",
      "owner@example.com",
      "--name",
      "Docs",
      "--slug",
      "docs",
    ]);

    const setResult = await runCli([
      "storage:set",
      "--project",
      "docs",
      "--library",
      "media",
      "--provider",
      "supabase_bucket",
      "--bucket",
      "media",
      "--public-url-base",
      "https://cdn.example.com/media",
      "--json",
    ]);
    const setBody = JSON.parse(setResult.stdout);

    expect(setResult.exitCode).toBe(0);
    expect(setBody.storage).toMatchObject({
      bucketName: "media",
      provider: "supabase_bucket",
      publicUrlBase: "https://cdn.example.com/media",
    });

    const getResult = await runCli([
      "storage:get",
      "--project",
      "docs",
      "--library",
      "media",
      "--json",
    ]);
    const getBody = JSON.parse(getResult.stdout);
    const config = await readSavedConfig();

    expect(getResult.exitCode).toBe(0);
    expect(getBody.storage.provider).toBe("supabase_bucket");
    expect(JSON.stringify(config)).not.toContain("BASEBUDDY_SUPABASE_SECRET_KEY");
    expect(JSON.stringify(config)).not.toContain("secret");
  });

  it("lists and safely deletes users without deleting the last owner of a project", async () => {
    await writeFile(
      getBaseBuddyConfigPath(),
      `${JSON.stringify(createDefaultBaseBuddyConfig({ now: fixedNow }), null, 2)}\n`,
      "utf8",
    );
    await runCli([
      "user:create",
      "--email",
      "owner@example.com",
      "--name",
      "Owner User",
      "--password",
      "PlainPass1!",
    ]);
    await runCli([
      "user:create",
      "--email",
      "viewer@example.com",
      "--name",
      "Viewer User",
      "--password",
      "PlainPass1!",
    ]);
    await runCli([
      "projects:create",
      "--actor-email",
      "owner@example.com",
      "--name",
      "Docs",
      "--slug",
      "docs",
    ]);
    await runCli([
      "members:add",
      "--project",
      "docs",
      "--actor-email",
      "owner@example.com",
      "--email",
      "viewer@example.com",
      "--roles",
      "viewer",
    ]);

    const listResult = await runCli(["users:list", "--json"]);
    const listBody = JSON.parse(listResult.stdout);

    expect(listResult.exitCode).toBe(0);
    expect(listBody.users.map((user: { email: string }) => user.email)).toEqual([
      "owner@example.com",
      "viewer@example.com",
    ]);

    const blockedDelete = await runCli([
      "users:delete",
      "--email",
      "owner@example.com",
    ]);

    expect(blockedDelete.exitCode).toBe(1);
    expect(blockedDelete.output).toContain("last owner");

    const deleteResult = await runCli([
      "users:delete",
      "--email",
      "viewer@example.com",
      "--json",
    ]);
    const config = await readSavedConfig();

    expect(deleteResult.exitCode).toBe(0);
    expect(config.users.map((user: { email: string }) => user.email)).toEqual([
      "owner@example.com",
    ]);
    expect(config.projects[0].members).toHaveLength(1);
  });

  it("shows storage env status without writing storage secrets to config", async () => {
    vi.stubEnv("BASEBUDDY_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("BASEBUDDY_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("BASEBUDDY_SUPABASE_SECRET_KEY", "secret-key");
    vi.stubEnv("BASEBUDDY_S3_ACCESS_KEY_ID", "s3-access-key");
    vi.stubEnv("BASEBUDDY_S3_SECRET_ACCESS_KEY", "s3-secret-key");
    await writeFile(
      getBaseBuddyConfigPath(),
      `${JSON.stringify(createDefaultBaseBuddyConfig({ now: fixedNow }), null, 2)}\n`,
      "utf8",
    );

    const result = await runCli(["storage:status", "--json"]);
    const body = JSON.parse(result.stdout);
    const config = await readSavedConfig();

    expect(result.exitCode).toBe(0);
    expect(body.sections.map((section: { title: string }) => section.title)).toContain("Supabase storage");
    expect(body.sections.map((section: { title: string }) => section.title)).toContain("S3-compatible storage");
    expect(result.output).not.toContain("secret-key");
    expect(result.output).not.toContain("s3-secret-key");
    expect(JSON.stringify(config)).not.toContain("secret-key");
  });
});
