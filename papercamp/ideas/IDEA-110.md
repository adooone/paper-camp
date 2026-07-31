---
id: IDEA-110
title: In-app code review with diffs
type: feat
status: review
created: 2026-07-30
updated: 2026-07-30
tags:
  - app
  - git
  - ui
subject: Richer review loop
order: 5
---

A dedicated view for reading the changes before you deliver — the target of the "N files changed" link from the Deliver card ([[IDEA-109]]). Review your working tree in-app instead of dropping to a terminal or the GitHub PR.

What it needs:
- A per-file diff feed from the server — `git.ts` already has a `diff` helper; expose it as a route returning the working-tree diff grouped by file (staged + unstaged).
- A diff renderer: per-file, collapsible, added/removed lines, path + change-count header. Handle large/binary/renamed files.
- Navigation from the file-count link, and back.

This view is read-only — for reading changes before you deliver. No annotating hunks or dispatching fixes from here.

### Phases
- [x] Expose a working-tree diff route grouped by file
      Serve the `git.ts` `diff` helper over a route returning staged + unstaged changes per file, with path and add/remove counts.
- [x] Build the per-file collapsible diff renderer
      Path + change-count header, collapsible body, added/removed line styling.
- [x] Handle large, binary, and renamed files
      Collapse or stub oversized/binary diffs; show rename headers instead of a full re-add.
- [x] Wire navigation from the Deliver card and back
      Route the "N files changed" link into the view and provide a return path.
- [x] Type-check and full pass

### Thread
- [x] 2026-07-31 [log] Run-all parked on phase 5 ("Annotate a hunk and hand it to an agent (stretch)") — the agent needs a decision: This phase asks to annotate a hunk and dispatch it to an agent via `fix-review`/`review-split`, but neither mechanism fits the diff view's actual context. `fix-review` operates on GitHub PR review threads for a specific plan's already-open PR; `review-split` (the `AddReviewPhasesButton` → `parseReviewFindings` flow) adds findings as phases on a specific plan. The `/diff` route (built in earlier phases) is a global working-tree view with no plan association at all — it's reached from the Deliver card's "N files changed" link before a PR even exists. Every agent-launch mechanism in this codebase (`launchFixReview`, `launchAgent`, `launchPlanAudit`, etc.) requires a `planId`.

To implement this stretch phase I need a decision on: (1) should annotating a hunk require picking a plan first (e.g. a plan selector in the diff view), and (2) should the note become a new phase on that plan for later dispatch (reusing `review-split`'s phase-adding shape), or trigger an immediate one-off agent edit against the working tree (a new mechanism, since none of the existing `launch*` calls fit a PR-less, phase-less single-hunk fix)? I don't want to invent this product decision on my own.
- [x] 2026-07-31 [log] Decision — the diff view is read-only, for viewing changes only. Dropped the "annotate a hunk and hand it to an agent" stretch phase; no note-taking or agent dispatch from this view. The scope is the viewer (phases 1–4) plus the type-check pass.
