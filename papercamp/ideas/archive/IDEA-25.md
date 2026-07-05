---
id: IDEA-25
title: Actualize about.md for per-file storage
type: docs
status: done
created: 2026-07-01
updated: 2026-07-01
tags:
  - docs
  - per-file
  - about
---

Actualized about.md for the per-file storage reality after FEAT-24, verified section-by-section against the code.

### Phases
- [x] Audit stale sections against source code
      Read `src/core/scaffold.ts`, `parser.ts`, `serializer.ts`, `src/cli/index.ts`, and `src/app/server/api.ts` to confirm current reality for each flagged area before editing — the doc has drifted before, so verify rather than assume.
- [x] Fix file table and intro references
      Update the file table (~196–197) to remove `ideas.md`/`plans.md` and replace with `papercamp/plans/` and `papercamp/ideas/` dirs. Fix line 3 (philosophy pointer) and line 175 (FEAT-24 reference) that still point at the removed files.
- [x] Rewrite storage schema sections
      Collapse or redirect the `### ideas.md` / `### plans.md` schema sections (~229, ~233) and the "How structure is added" block (~214). Describe the per-file YAML frontmatter shape as the primary path; note that `decisions.md`/`open-questions.md`/`progress.md` remain monolithic and explain why.
- [x] Update CLI command descriptions
      Correct the CLI table entries for `init` (~317) and `add plan` (~319): `init` scaffolds `plans/` and `ideas/` dirs (not the removed monolithic files); `add plan` writes a new `plans/<ID>.md` file.
- [x] Update parser/serializer descriptions
      Rewrite ~329–330 to name `parsePlanFile`/`parseIdeaFile`, `readAllPlanFiles`, `readPlansMerged`/`readIdeasMerged`, and `formatPlanFile`/`formatIdeaFile` as the primary path, with the monolithic parsers noted only as back-compat fallbacks.
- [x] Fix dashboard reading model and filename case
      Update the dashboard section (~393–394) to reference per-file sources. Fix the filename-case inconsistency in the per-file section itself: use uppercase IDs (`FEAT-24.md`, `IDEA-20.md`) to match what the migration actually produced.
