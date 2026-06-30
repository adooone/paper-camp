---
id: REFACTOR-3
title: Drop Focus page and unify sidebar
kind: refactor
status: done
created: 2026-06-19
updated: 2026-06-21
tags:
  - app
  - plans
  - ui
---

Focus mode's only real value over the Plans page's `PlanDetail` view is that its phase
checklist is interactive (toggleable) while `PlanDetail`'s is read-only (`disabled`
checkboxes), plus the per-phase AI copy-prompt and "Mark complete" button. None of that
requires a separate distraction-free route — folding it into `PlanDetail` removes a
whole page or both for no real loss.

Separately: the per-route sidebar swap is the cause of the layout jump noticed when
switching pages. `router.tsx` conditionally mounts a completely different sidebar
component per route (`{pathname === '/' && <PlansSidebar />}`, etc.), so navigating
destroys and recreates the whole sidebar DOM tree instantly while the main content
fades/slides via `framer-motion` — that mismatch is the jump. It's worst on `/focus`
since that route has no sidebar at all, so the content width jumps too. A single
persistent sidebar shell that swaps its items per route (instead of swapping components)
fixes both the jump and the inconsistency in one move, and becomes moot for `/focus` once
that route is gone.

### Phases
- [x] Make PlanDetail checklist interactive
      Make `PlanDetail`'s phase checklist interactive: enable the checkboxes (currently `disabled`), wire them to the same `PATCH /api/plans` phase-toggle flow `FocusPage` uses, and add the per-phase `FocusPhaseItem` copy-prompt button and a "Mark complete" button (shown when all phases are done) directly in `PlanDetail`
- [x] Remove Focus route and nav item
      Remove the `/focus` route entirely: drop `focusRoute` and the "Focus" nav item from `router.tsx`, delete `src/app/features/focus/`, and update `PlanCard`'s and `PlanDetail`'s "Start" handlers to stay on the Plans page (opening the plan's detail view) instead of navigating to `/focus`
- [x] Build persistent sidebar shell
      Build one persistent sidebar shell mounted once in `router.tsx` (not per-route), with a per-route config (icon/title plus item list) driving what renders inside it — replacing the current `PlansSidebar`/`DocsSidebar`/`SettingsSidebar` conditional-mount pattern
- [x] Verify route transition animation
      Re-verify route transitions with the persistent sidebar in place: the sidebar's item list should swap (animated, not an instant cut) in sync with the main content's existing fade/slide, so nothing in the layout jumps when switching pages
