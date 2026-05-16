type GeneratedContentTables = {
  postCategories: string;
  postRevisions: string;
  posts: string;
  postTags: string;
};

export const buildGeneratedContentAuthorScopePredicate = ({
  alias,
  parameterIndex,
}: {
  alias: string;
  parameterIndex: number;
}) => `${alias}.author_id::text = any($${parameterIndex}::text[])`;

export const buildGeneratedContentUniqueSlugLookupQuery = ({
  tableName,
}: {
  tableName: string;
}) => `
        select id::text
        from ${tableName}
        where slug = $1
          and ($2::uuid is null or id <> $2::uuid)
        limit 1
      `;

export const buildGeneratedContentPostByIdQuery = ({
  supportsFormatAwareSchema,
  tables,
}: {
  supportsFormatAwareSchema: boolean;
  tables: GeneratedContentTables;
}) => `
          select
            p.id::text,
            p.author_id::text,
            p.title,
            p.slug,
            p.status,
            ${supportsFormatAwareSchema ? "p.content_format,\n            " : ""}p.excerpt,
            p.content_json,
            ${supportsFormatAwareSchema ? "p.content_markdown,\n            " : ""}p.content_html,
            p.seo_title,
            p.seo_description,
            p.focus_keyword,
            p.featured_image_url,
            p.published_at,
            p.created_at,
            p.updated_at,
            coalesce(
              array(
                select pc.category_id::text
                from ${tables.postCategories} as pc
                where pc.post_id = p.id
                order by pc.created_at asc, pc.category_id asc
              ),
              '{}'::text[]
            ) as category_ids,
            coalesce(
              array(
                select pt.tag_id::text
                from ${tables.postTags} as pt
                where pt.post_id = p.id
                order by pt.created_at asc, pt.tag_id asc
              ),
              '{}'::text[]
            ) as tag_ids
          from ${tables.posts} as p
          where p.id = $1::uuid
          limit 1
        `;

export const buildGeneratedContentNextPostRevisionNumberQuery = ({
  tableName,
}: {
  tableName: string;
}) => `
      select coalesce(max(revision_number), 0) + 1 as next_revision
      from ${tableName}
      where post_id = $1::uuid
    `;

export const buildGeneratedContentInsertPostRevisionQuery = ({
  supportsFormatAwareSchema,
  tables,
}: {
  supportsFormatAwareSchema: boolean;
  tables: Pick<GeneratedContentTables, "postRevisions">;
}) =>
  supportsFormatAwareSchema
    ? `
        insert into ${tables.postRevisions} (
          id,
          post_id,
          revision_number,
          editor_user_id,
          editor_email,
          title,
          slug,
          status,
          excerpt,
          content_format,
          content_json,
          content_markdown,
          content_html,
          seo_title,
          seo_description,
          focus_keyword,
          featured_image_url,
          published_at
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4::uuid,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11::jsonb,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18::timestamptz
        )
      `
    : `
      insert into ${tables.postRevisions} (
        id,
        post_id,
        revision_number,
        editor_user_id,
        editor_email,
        title,
        slug,
        status,
        excerpt,
        content_json,
        content_html,
        seo_title,
        seo_description,
        focus_keyword,
        featured_image_url,
        published_at
      )
      values (
        $1::uuid,
        $2::uuid,
        $3,
        $4::uuid,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16::timestamptz
      )
    `;
