---
id: FEAT-41
title: Filter and sort the plans list
kind: feat
status: in-progress
created: 2026-07-04
idea: IDEA-42
updated: 2026-07-04
tags:
  - app
  - ui
  - plans
---

FEAT-37's dense rows made plans scannable, but navigation is still scroll-by-section:
In progress/Backlog headings, a separate paginated Closed section, and no way to slice
the list by intent. This plan replaces the sections with one flat all-status list in
`list-view.tsx` — a single `plan-rows.tsx` roster covering in-progress, review,
planned, backlog, done, and dropped, retiring `closed-section.tsx` — driven by a
sticky kraft `Card` pinned below the app header. The card is filters and analytics at
once: status chips carrying live counts ("In progress 1 · Review 2 · Done 40") that
toggle as filters, the top few tags as clickable count-stamps with the rest behind an
overflow, a search input matching title/body, and a compact sort control (status
precedence default, then updated/created/title/id/phase progress, with direction
toggle). `list-toolbar.tsx`'s Audit-all, view toggle, and Add-to-backlog absorb into
the same card, so the page has one control surface instead of two. The idea's open
first-paint question is decided here: done/dropped chips default off (no windowed
show-more), so 40+ closed plans stay out of first paint via the same mechanism that
reveals them.

Everything is pure client-side filtering/sorting over the already-loaded
`plans.entries` — no storage or API changes. The filter/sort state and derivation
live in a factored selector (hook/module), not inline in `list-view.tsx`, because
[[IDEA-43]] turns these rows into a two-level idea-grouped tree and the logic must
survive that. Coordination: [[FEAT-39]]'s focus hero renders above this list and is
untouched; the board view keeps its fixed lanes; and [[FEAT-40]]'s route-level
Closed tab overlaps with done/dropped chips — if this lands first, that tab likely
reduces to a preset of these filters, to be reconciled when FEAT-40 starts. Nothing
blocks this — it builds directly on FEAT-37's landed row-card list.

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
- [ ] Absorb the toolbar into the card
      Move Audit-all, the view toggle, and Add-to-backlog from `list-toolbar.tsx`
      into the sticky card and delete `list-toolbar.tsx`.
- [ ] Type-check and visual pass
      `tsc --noEmit`, `biome check`, tests, and a browser pass over chip toggling,
      counts, search, sort directions, sticky behavior while scrolling, and the
      done/dropped reveal with 40+ closed plans.
