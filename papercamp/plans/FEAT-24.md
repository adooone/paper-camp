---
id: FEAT-24
title: Plan storage architecture
kind: feat
status: review
created: 2026-06-28
idea: IDEA-20
updated: 2026-06-28
tags:
  - core
  - cli
  - plans
  - ideas
---

Replace the single monolithic plans.md/ideas.md files with one file per plan/idea, each using YAML frontmatter for metadata instead of the current ad-hoc line grammar. This eliminates cross-branch merge conflicts (two branches editing two plans now touch two files, not two regions of one), speeds up agent reads (one small file per plan instead of a 1000-entry monster), and replaces the fragile hand-rolled line parser with a real YAML parser feeding into the existing zod schemas. Also folds .paper-camp/ (config/assets) into the visible papercamp/ directory. See ideas.md's IDEA-20 for the full rationale.

### Phases
- [x] Design per-file schema, directory layout, and migration plan
      Finalize the YAML frontmatter metadata format, directory structure (papercamp/plans/, papercamp/ideas/, archive/), filename convention (id-only vs id+slug), and config migration from .paper-camp/ into papercamp/. Document the spec in about.md, generated from zod schemas via zod-to-json-schema.
- [x] Build frontmatter parser/serializer
      Replace the hand-rolled line grammar in core/parser.ts with a real YAML frontmatter parser feeding into the existing zod schemas. Update serializer.ts and schemas.ts. Generate the frontmatter spec from zod schemas as the single source of truth.
- [x] Generate index files
      Build index generators for papercamp/plans/index.md and papercamp/ideas/index.md (id, title, status, tags only), regenerated on every write.
- [x] Implement archive as file move
      A plan moving to done/dropped moves its file from papercamp/plans/ to papercamp/plans/archive/ — no parse-and-re-serialize step.
- [x] Update CLI and dashboard API routes
      Update CLI commands (init, add plan) and every API route (/api/plans, /api/ideas, etc.) to read/write per-file entries instead of the monolithic files.
- [x] Move .paper-camp/ config and assets into papercamp/
      Move config.json and assets from .paper-camp/ into papercamp/, update all code references across the entire codebase.
- [x] Write and run one-time migration script
      Split the current plans.md and ideas.md into individual per-file entries under the new layout, preserving every entry and its full content.

### Log
- 2026-06-28: Review pass on phases 1-5 found three real bugs, all fixed: (1) `app-store.ts` (client-bundled) imported `deriveIdeaStatuses` from `core/parser.ts`, pulling parser.ts's new `node:fs/promises` `readdir` import into the browser bundle and breaking both `pnpm run build` and the dev server — extracted `deriveIdeaStatuses` into a new dependency-free `core/idea-status.ts`. (2) `planFrontmatterSchema` had no `title` field, so every plan written through the new per-file path (`POST /api/plans`, `add plan` CLI) silently lost its human-readable name — `parsePlanFile()` fell back to using the plan's `id` as its title. Added `title` to `planFrontmatterSchema`, `NewPlanFileInput`/`formatPlanFile()`, and every call site (`api.ts`'s create/demote/update paths, `cli/index.ts`). (3) `DELETE /api/plans` didn't actually delete the per-file plan — it emptied the file then renamed it to `_deleted_<id>.md`, leaving a permanent stray file that `readAllPlanFiles()` would keep re-parsing forever (harmlessly, since empty, but it's dead clutter). Replaced with a real `unlink()`. Updated `about.md`'s documented frontmatter spec/JSON Schema and the 20 frontmatter tests to match. `tsc`/`biome`/`vitest` all clean (55 tests), `pnpm run build` succeeds end-to-end.
- 2026-06-28: Built and ran the one-time migration script as `paper-camp migrate` (CLI command, not a throwaway script) — published-package users on an older monolithic `papercamp/` layout need the same upgrade path, not just this repo. Splits `plans.md`/`ideas.md` into per-file entries via the existing `parsePlans`/`parseIdeas`/`formatPlanFile`/`formatIdeaFile`, idempotent (skips any target file that already exists, so it's safe to re-run), and routes `done`/`dropped` plans directly into `papercamp/plans/archive/` instead of the active `plans/` directory, matching the archive mechanism's end state. Ran it against this repo's real `papercamp/` data: migrated all 30 plans (28 to archive, FEAT-23 and this plan itself to the active directory) and all 22 ideas, zero skipped, zero warnings — every plan already had an `Id` so there were no unmigratable entries. Regenerated both `index.md` files and replaced `plans.md`/`ideas.md`'s content with a one-line pointer comment (kept the files rather than deleting them, so the old paths don't 404 for anyone navigating by habit). This was the plan's last unchecked phase — Status set to `review` per `AGENTS.md`.
