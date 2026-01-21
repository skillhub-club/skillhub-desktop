# Changelog

## [Unreleased]
- Add user-hosted Marketplace: list `/api/user/skills/public` with search, category/tag/cover filters, pagination, and metadata (owner/views/installs).
- Reuse `SkillCard` with cover placeholder and floating Preview CTA; preview SKILL.md then install to personal or project targets.
- Fix user skill external links to `/web/skills/<slug>` (slashes normalized) from cards.
- Dev UX: in browser dev, fall back to prod API when localhost API would hit CORS.
- Create Skill: ensure binary uploads/exports use Blob/ArrayBuffer to satisfy TS and uploads.

