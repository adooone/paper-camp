---
id: FEAT-37
title: Densify the plans worklist
kind: feat
status: in-progress
created: 2026-07-04
idea: IDEA-38
updated: 2026-07-04
tags:
  - app
  - ui
  - plans
  - ideas
---

The Plans page's lists are sized for reading, not scanning: each kraft `PlanCard` in `list-view.tsx` spends ~280px on a 1.3rem serif title, rank number, status stamp, date, tags, and progress bar, so a typical laptop window shows about 1.5 plans per screen; `ideas-board.tsx`'s two-lane board wraps titles into a ~100px column while the right half of every row sits empty; `closed-section.tsx` dumps 40+ done titles behind a single toggle; and `plans-sidebar.tsx` repeats the same plans and ideas as a second, truncated list. This plan makes one authority for lists — dense table rows — and applies it everywhere: plans, ideas, closed plans, and the plan-detail preamble all compress to scannable rows, and the now-redundant sidebar item lists go away.

Approach (revised after the first phase-1 run): the dense lists are **not** paper-ui `Table` — they are hand-composed rows that *look* like a table, each row a one-line paper-ui `Card` with compact padding and small gaps, under a header row that is itself a `Card` in a contrasting paper texture. Two reasons: it keeps the warm card language the rest of the app uses, and it sidesteps a real blocker — `TableCellDropdown`, which the original sketch named for inline status edits, exists in paper-ui's source but was never exported from its public API (neither `dist/index.js` nor `dist/index.d.ts` carry it). The export gap ended up moot: on review, inline editing was dropped from the rows entirely — status renders as a read-only `Stamp` (smaller than any control, leaving the width to the title) and status changes happen inside the plan detail. `Pagination` (from the `FEAT-34` bump) still serves the closed section, and [[IDEA-34]]'s responsive shell (`FEAT-33`) settled the layout the denser views sit in. Removing the sidebar's In progress/Planned/Ideas/Backlog item lists was explicitly deferred out of [[IDEA-34]] to this idea — Docs and Settings keep their sidebars, since those are real section navigation rather than a duplicate of the main content. Plans and ideas also stop sharing one page: each list gets its own route and view, with the header nav switching between them.

### Phases
- [x] Convert the plans list to table rows
      Replace `list-view.tsx`'s stacked `PlanCard`s with a hand-composed row list (`plan-rows.tsx`): each row a one-line `Card` with compact padding and small gaps, sharing a grid column template with a header `Card` in a contrasting paper texture (kraft header over canvas rows). Columns: FEAT-id `Stamp`, title, updated date, a small phase-progress bar, and a status `Stamp` — the title owns all flexible space and rows are read-only; status changes happen inside the plan detail. Row click opens the plan detail as before; the updated column collapses away below the sidebar breakpoint.
- [x] Move list actions into the list header
      Host Audit-all and the list/board view toggle in the row list's header area, replacing the ad-hoc header row `plans-page.tsx` currently composes above the list.
- [ ] Rework the ideas board into full-width rows
      Replace `ideas-board.tsx`'s two-lane board with full-width rows in the same row-card style as the plans list, fixing the wrapped-title/empty-half-row problem. "Draft plan" stays a per-row action.
- [ ] Split plans and ideas onto separate routes
      Ideas leave the Plans page: add an `/ideas` route rendering the ideas row list as its own view, with an "Ideas" item in the header nav to switch between the two lists. Deep-linking *individual* plans/ideas stays out of scope — that's [[IDEA-40]]. The Plans page keeps In progress/Backlog/Closed only.
- [ ] Bound the closed plans section
      Add paper-ui `Pagination` (or a windowed "show more") to `closed-section.tsx` so 40+ done plans no longer render as one unbounded list behind a single toggle.
- [ ] Replace the plans sidebar's duplicate lists
      Swap `plans-sidebar.tsx`'s In progress/Planned/Ideas/Backlog item lists for section filters plus counts — or drop the Plans sidebar entirely if the filters don't earn their space. Preserve the actions the lists carried (add to backlog, per-item delete) wherever they move.
- [ ] Compress the plan detail preamble
      Fold `plan-detail.tsx`'s five stacked metadata rows (status select, date+tags, clarify button, progress, agent select) into a single header line plus one meta line before the content starts.
- [ ] Type-check and visual pass
      Run `tsc --noEmit`, `biome check . --write`, and the test suite; then a browser pass over the dense plans table, ideas rows, paginated closed section, sidebar replacement, and compressed plan detail at laptop and narrow widths.
