---
id: IDEA-28
title: Demote idea headings to h2
type: chore
status: done
created: 2026-07-01
updated: 2026-07-01
tags:
  - markdown
  - linting
  - ideas
---

Demoted idea body headings from h3 to h2 so new idea files stop tripping markdownlint MD001.

### Phases
- [x] Audit idea-creation code for hardcoded `###`
      Check `formatIdeaFile` and the Add-idea flow (CLI and/or API) for any hardcoded `###` heading; change to `##` so new files are created correctly from the start.
- [x] Update code references that cite `### IDEA-N:`
      In `src/app/features/plans/prompts.ts` (`buildIdeaExtendPrompt`), change the guard comment from `### IDEA-N:` to `## IDEA-N:`. In `src/core/parser.ts` (~line 401), update the format comment to match. Grep the full src tree for any remaining `### IDEA` literals.
- [x] Bulk-demote all existing idea files
      For every `papercamp/ideas/IDEA-*.md`, replace the opening `### IDEA-` line with `## IDEA-`. Verify no other headings in those files are affected.
