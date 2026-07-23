---
id: IDEA-78
title: Responsive polish for phone widths
type: feat
status: idea
created: 2026-07-21
subject: Mobile control desk
tags:
  - app
  - ui
  - layout
order: 4
---

From the roadmap: Horizon 3 — Beyond one desk — Mobile control desk.

### Phases
- [x] Establish phone breakpoints and audit what breaks
      Pin a phone breakpoint in `styles/tokens.ts` (`layout`) and walk the dashboard
      at ~375px, cataloguing the concrete failures: the left `SidebarShell` and the
      right-docked `StackPanel` both steal horizontal space the content needs, the
      nav-island pill, tables, and modals overflow. Output is the list of surfaces the
      later phases fix, no behaviour change yet.
- [x] Reflow the layout shell — sidebar and Stack panel as drawers
      Below the phone breakpoint, collapse the persistent left `SidebarShell` and the
      right `StackPanel` from always-docked columns into off-canvas drawers (toggled,
      overlaying the content) so `Outlet` gets the full viewport width; drop the
      `stackPanelWidth` content padding at that width.
- [x] Stack the content surfaces
      Make the Plans worklist/`PlanCard`, the phase `Table`, board view, and
      `EntityDetail`/`NoteDetail` reflow to a single column at phone width — tables and
      the kanban board go vertical rather than scrolling sideways, headers and stamp
      rows wrap instead of clipping.
- [x] Size touch targets and reach the nav island one-handed
      Bump tap targets (checkboxes, `IconButton`s, card hit areas) to a comfortable
      minimum and reposition the floating nav island so Plans/Review/Docs/Settings and
      the drawer toggles are reachable one-handed near the bottom of the screen.
- [ ] Gate the pass
      Run `tsc --noEmit`, `npx biome check . --write`, and `pnpm test`; confirm the
      comment-ratio guard stays under budget and nothing regressed at desktop widths.
