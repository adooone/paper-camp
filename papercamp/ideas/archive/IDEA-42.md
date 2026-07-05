---
id: IDEA-42
title: Filter and sort the plans list
type: feat
status: done
created: 2026-07-04
updated: 2026-07-05
tags:
  - app
  - ui
  - plans
---

One flat all-status plans list driven by a sticky filter/sort card: status chips with live counts, tag chips, search, and a sort control.

### Phases
- [x] Build the filter/sort selector and flat list
      Add a factored selector (hook/module over `plans.entries`) computing the
      filtered+sorted rows plus per-status and per-tag counts; `list-view.tsx`
      renders one `plan-rows.tsx` list from it — default sort status precedence
      (in-progress → review → planned → backlog → done → dropped) then updated,
      done/dropped excluded by default — and `closed-section.tsx` is retired.
- [x] Build the sticky filter card with status chips
      A sticky kraft `Card` pinned below the app header (matching the list header's
      texture): status chips with live counts that toggle the selector's status
      filters, done/dropped chips defaulting off as the first-paint guard.
- [x] Add tag chips and search
      The top few tags as clickable count-stamps in the card with the rest behind
      an overflow control, plus a search input matching plan title and body.
- [x] Add the sort control
      A compact sort control in the card: status precedence (default), updated,
      created, title, id, phase progress — with a direction toggle. Applies to the
      rows list only; the board view keeps its fixed lanes.
- [x] Absorb the toolbar into the card
      Move Audit-all, the view toggle, and Add-to-backlog from `list-toolbar.tsx`
      into the sticky card and delete `list-toolbar.tsx`.
- [x] Type-check and visual pass
      `tsc --noEmit`, `biome check`, tests, and a browser pass over chip toggling,
      counts, search, sort directions, sticky behavior while scrolling, and the
      done/dropped reveal with 40+ closed plans.
