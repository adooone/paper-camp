---
id: CHORE-1
title: Demote idea headings to h2
kind: chore
status: done
created: 2026-07-01
idea: IDEA-28
updated: 2026-07-01
tags:
  - markdown
  - linting
  - ideas
---

Every idea file opens its body with `### IDEA-N: Title` — a level-3 heading that jumps straight past h1 and h2, triggering markdownlint MD001 on every new file. CodeRabbit surfaces this as a per-file nitpick on each idea PR; fixing it file-by-file would only create an inconsistent mix of `##` and `###`. The correct fix is a single repo-wide demotion from `###` to `##`, applied to all ~26 existing idea files and to every code path that generates or validates that heading.

The body heading is kept rather than dropped: while the frontmatter carries the same title, several prose references in prompts and comments cite the `### IDEA-N:` literal, and the heading also serves as a visual anchor when reading a raw file. Demoting to `##` fixes the lint rule with the smallest surface change.

### Phases
- [x] Audit idea-creation code for hardcoded `###`
      Check `formatIdeaFile` and the Add-idea flow (CLI and/or API) for any hardcoded `###` heading; change to `##` so new files are created correctly from the start.
- [x] Update code references that cite `### IDEA-N:`
      In `src/app/features/plans/prompts.ts` (`buildIdeaExtendPrompt`), change the guard comment from `### IDEA-N:` to `## IDEA-N:`. In `src/core/parser.ts` (~line 401), update the format comment to match. Grep the full src tree for any remaining `### IDEA` literals.
- [x] Bulk-demote all existing idea files
      For every `papercamp/ideas/IDEA-*.md`, replace the opening `### IDEA-` line with `## IDEA-`. Verify no other headings in those files are affected.
