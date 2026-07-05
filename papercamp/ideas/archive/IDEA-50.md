---
id: IDEA-50
title: Drop Focus page and unify sidebar
type: refactor
status: done
created: 2026-06-19
updated: 2026-06-21
tags:
  - app
  - plans
  - ui
---

Dropped the Focus page, folding its interactive phase checklist and per-phase copy-prompt into PlanDetail.

### Phases
- [x] Make PlanDetail checklist interactive
      Make `PlanDetail`'s phase checklist interactive: enable the checkboxes (currently `disabled`), wire them to the same `PATCH /api/plans` phase-toggle flow `FocusPage` uses, and add the per-phase `FocusPhaseItem` copy-prompt button and a "Mark complete" button (shown when all phases are done) directly in `PlanDetail`
- [x] Remove Focus route and nav item
      Remove the `/focus` route entirely: drop `focusRoute` and the "Focus" nav item from `router.tsx`, delete `src/app/features/focus/`, and update `PlanCard`'s and `PlanDetail`'s "Start" handlers to stay on the Plans page (opening the plan's detail view) instead of navigating to `/focus`
- [x] Build persistent sidebar shell
      Build one persistent sidebar shell mounted once in `router.tsx` (not per-route), with a per-route config (icon/title plus item list) driving what renders inside it — replacing the current `PlansSidebar`/`DocsSidebar`/`SettingsSidebar` conditional-mount pattern
- [x] Verify route transition animation
      Re-verify route transitions with the persistent sidebar in place: the sidebar's item list should swap (animated, not an instant cut) in sync with the main content's existing fade/slide, so nothing in the layout jumps when switching pages
