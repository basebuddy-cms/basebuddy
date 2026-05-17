# Changelog

All notable public changes to BaseBuddy will be documented here.

This project follows a practical changelog format. Dates use `YYYY-MM-DD`.

## Unreleased

### Added

- Public self-host documentation for installation, configuration, mapping, editing, permissions, deployment, operations, security, and troubleshooting.
- Support guides for common setup and editing tasks.
- Hosted demo deployment path for `demo.basebuddycms.com`.
- Public website deployment path for `basebuddycms.com`.

### Changed

- Public repository metadata now points to `https://basebuddycms.com`, `https://demo.basebuddycms.com`, and `https://github.com/basebuddy-cms/basebuddy`.

## 0.1.0 - Initial Public Release

### Added

- BaseBuddy self-host app for mapping existing Supabase and Postgres schemas into an editor.
- Project mapping flow for posts, authors, categories, tags, media, files, SEO fields, status fields, and sidebar fields.
- Safe editing model where normal save writes dirty fields only.
- Explicit publish, unpublish, and archive actions.
- Role-based and user-specific permission controls.
- Supabase and S3-compatible storage support through saved mappings.
- Setup checker for validating required self-host environment and database configuration.
- Example environment files for local setup and Playwright testing.
