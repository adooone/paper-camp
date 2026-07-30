---
id: IDEA-110
title: In-app code review with diffs
type: feat
status: idea
created: 2026-07-30
updated: 2026-07-30
tags:
  - app
  - git
  - ui
subject: Richer review loop
---

A dedicated view for reading the changes before you deliver — the target of the "N files changed" link from the Deliver card ([[IDEA-109]]). Review your working tree in-app instead of dropping to a terminal or the GitHub PR.

What it needs:
- A per-file diff feed from the server — `git.ts` already has a `diff` helper; expose it as a route returning the working-tree diff grouped by file (staged + unstaged).
- A diff renderer: per-file, collapsible, added/removed lines, path + change-count header. Handle large/binary/renamed files.
- Navigation from the file-count link, and back.

Stretch, converging with the existing review paths: annotate a hunk with a note and hand it to an agent to fix (reuse `fix-review`/`review-split`), so review findings become changes without leaving the view. Scope the first cut to read-only diffs; layer the agent actions after.
