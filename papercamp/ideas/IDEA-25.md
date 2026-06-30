---
id: IDEA-25
title: Actualize about.md for per-file storage
---

### IDEA-25: Actualize about.md for per-file storage

`papercamp/about.md` is the project's internal reference doc ("the concrete shape of the system: folders, files, commands, and stack"), and it's now **internally contradictory** after the FEAT-24 / IDEA-20 per-file migration. It already grew a `## Per-file plan/idea storage architecture` section (about.md:7) describing the new layout, but the rest of the doc still describes the old monolithic `plans.md`/`ideas.md` as the storage — so the same document now says two different things, and several details match neither reality.

**Concrete stale points to reconcile (line numbers will drift):**
- **File table (~196–197):** lists `ideas.md` / `plans.md` as the storage files. They've been removed; plans/ideas now live as one file per record under `papercamp/plans/` (+ `archive/`) and `papercamp/ideas/`. Only `decisions.md`, `open-questions.md`, `progress.md` stay monolithic.
- **"How structure is added" (~214) + the `### ideas.md` / `### plans.md` schema sections (~229, ~233):** describe the old multi-record-per-file shape and argue real YAML frontmatter "doesn't fit" because each file holds multiple records. That's now inverted for plans/ideas — each is its own file with real top-of-file YAML frontmatter; the field-based shape only still applies to `decisions.md` / `open-questions.md` (and the date-log `progress.md`).
- **CLI table (~317, ~319):** `init` no longer creates `plans.md`/`ideas.md` (scaffold's `MONOLITHIC_FILES` is only progress/decisions/open-questions; it scaffolds `plans/` and `ideas/` dirs with `index.md`). `add plan` writes a new `papercamp/plans/<ID>.md` file, not "appends a `## <name>` entry to plans.md".
- **parser/serializer descriptions (~329–330):** reference `parsePlans`/`parseIdeas`/`formatPlans` against the monolithic files as the primary path. The primary path is now `parsePlanFile`/`parseIdeaFile` + `readAllPlanFiles`/`readPlansMerged`/`readIdeasMerged` + `formatPlanFile`/`formatIdeaFile`; the monolithic parsers survive only as a back-compat fallback for un-migrated projects.
- **Dashboard reading model (~393–394):** "Backlog — `plans.md` entries with `Status: idea`" and "Ideas parsed from `ideas.md`" — both now per-file.
- **Filename case (~42):** the per-file section itself says id-only **lowercase** (`feat-24.md`, `idea-20.md`), but the migration produced **uppercase** files (`FEAT-24.md`, `IDEA-20.md`). Pick reality (uppercase) and fix the doc.
- Line 3 ("philosophy and intent live in [ideas.md]") and line 175 ("See `plans.md`'s ... FEAT-24") point at the removed files too.

**Approach:** fold the scattered monolithic descriptions into / under the existing per-file section so the doc has one consistent storage story, rather than leaving a new section bolted on top of a stale one. Verify each claim against the actual code (`src/core/scaffold.ts`, `parser.ts`, `serializer.ts`, `src/cli/index.ts`, `src/app/server/api.ts`) while editing — the doc has clearly drifted from it.

**Out of scope:** do **not** migrate `decisions.md` / `open-questions.md` / `progress.md` to per-file — they're intentionally still monolithic; this idea only makes the doc match what shipped. Distinct from [[IDEA-22]] (which is about repo-*root* docs — README/AGENTS/CODE_STYLE), and is the documentation tail of [[IDEA-20]] (the per-file migration itself).
