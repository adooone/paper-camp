---
id: IDEA-110
title: In-app code review with diffs
type: feat
status: review
created: 2026-07-30
updated: 2026-07-31
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

### Fixes
- [x] Move the file list to a sidebar with always-visible diffs
      Replace the per-file collapse with a persistent file-list sidebar; render diff content always-visible in the main pane, with sidebar entries scrolling to their file's changes.
- [x] Render Fixes with the same row layout as Phases, not a nested Card
      Reuse the phase-row rendering for Fix items and remove the Card-inside-a-Card; keep the group distinct with a different paper texture background instead.
- [x] Use one shared progress bar at the top for phases and fixes together
      Remove the separate Fixes progress bar; the single top bar counts phases and open fixes as one.
- [x] Give open Fixes a way to run from the UI
      Surface a run action on the Fixes group so an open Fix can be executed like phases — there is currently no button to run one.

### Thread
- [x] 2026-07-31 [log] Run-all parked on phase 5 ("Annotate a hunk and hand it to an agent (stretch)") — the agent needs a decision: This phase asks to annotate a hunk and dispatch it to an agent via `fix-review`/`review-split`, but neither mechanism fits the diff view's actual context. `fix-review` operates on GitHub PR review threads for a specific plan's already-open PR; `review-split` (the `AddReviewPhasesButton` → `parseReviewFindings` flow) adds findings as phases on a specific plan. The `/diff` route (built in earlier phases) is a global working-tree view with no plan association at all — it's reached from the Deliver card's "N files changed" link before a PR even exists. Every agent-launch mechanism in this codebase (`launchFixReview`, `launchAgent`, `launchPlanAudit`, etc.) requires a `planId`.
- [x] 2026-07-31 [log] Decision — the diff view is read-only, for viewing changes only. Dropped the "annotate a hunk and hand it to an agent" stretch phase; no note-taking or agent dispatch from this view. The scope is the viewer (phases 1–4) plus the type-check pass.
- [x] 2026-07-31 [log] I want to make the diff view always visible content, and files list can be put into sidebar, to scroll into related code
- [x] 2026-07-31 [log] [agent] Makes sense — a persistent file-list sidebar with the diff always rendered in the main pane reads much better than collapsing per file, and it lets you jump to related code as you scroll. Added it as a new phase since the viewer's already built; it'll track as a Fix on top of the finished layout. (reopened this idea to re-run)
