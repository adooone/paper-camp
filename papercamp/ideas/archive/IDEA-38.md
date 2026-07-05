---
id: IDEA-38
title: Densify the plans worklist
type: feat
status: done
created: 2026-07-04
updated: 2026-07-04
tags:
  - app
  - ui
  - plans
  - ideas
---

Densified the plans worklist: row-cards (kraft header over one-line canvas rows) replacing the big cards, ideas split to their own route, the plans sidebar dropped, and the plan-detail preamble compressed.

### Phases
- [x] Convert the plans list to table rows
      Replace `list-view.tsx`'s stacked `PlanCard`s with a hand-composed row list (`plan-rows.tsx`): each row a one-line `Card` with compact padding and small gaps, sharing a grid column template with a header `Card` in a contrasting paper texture (kraft header over canvas rows). Columns: FEAT-id `Stamp`, title, updated date, a small phase-progress bar, and a status `Stamp` — the title owns all flexible space and rows are read-only; status changes happen inside the plan detail. Row click opens the plan detail as before; the updated column collapses away below the sidebar breakpoint.
- [x] Move list actions into the list header
      Host Audit-all and the list/board view toggle in the row list's header area, replacing the ad-hoc header row `plans-page.tsx` currently composes above the list.
- [x] Rework the ideas board into full-width rows
      Replace `ideas-board.tsx`'s two-lane board with full-width rows in the same row-card style as the plans list, fixing the wrapped-title/empty-half-row problem. "Draft plan" stays a per-row action.
- [x] Split plans and ideas onto separate routes
      Ideas leave the Plans page: add an `/ideas` route rendering the ideas row list as its own view, with an "Ideas" item in the header nav to switch between the two lists. Deep-linking *individual* plans/ideas stays out of scope — that's [[IDEA-40]]. The Plans page keeps In progress/Backlog/Closed only.
- [x] Bound the closed plans section
      Add paper-ui `Pagination` (or a windowed "show more") to `closed-section.tsx` so 40+ done plans no longer render as one unbounded list behind a single toggle.
- [x] Replace the plans sidebar's duplicate lists
      Swap `plans-sidebar.tsx`'s In progress/Planned/Ideas/Backlog item lists for section filters plus counts — or drop the Plans sidebar entirely if the filters don't earn their space. Preserve the actions the lists carried (add to backlog, per-item delete) wherever they move.
- [x] Compress the plan detail preamble
      Fold `plan-detail.tsx`'s five stacked metadata rows (status select, date+tags, clarify button, progress, agent select) into a single header line plus one meta line before the content starts.
- [x] Type-check and visual pass
      Run `tsc --noEmit`, `biome check . --write`, and the test suite; then a browser pass over the dense plans table, ideas rows, paginated closed section, sidebar replacement, and compressed plan detail at laptop and narrow widths.
