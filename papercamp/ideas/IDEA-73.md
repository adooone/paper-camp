---
id: IDEA-73
title: Smooth the page transitions
type: fix
status: idea
created: 2026-07-17
tags:
  - app
  - ui
  - performance
---

Page switches lag and don't feel smooth. Framer-motion usage is small (4 files: `router.tsx` route transitions, `stack-panel.tsx` slide, `sidebar-shell.tsx`, `refresh-button.tsx`) so this is a find-fix-simplify pass, not a rewrite. Three suspects are visible in `router.tsx` before any profiling:

1. **`AnimatePresence mode="wait"`** — the old page must finish its 200ms exit before the new one mounts, so every navigation starts with a built-in delay; with lazy routes behind `<Suspense fallback={null}>`, a blank gap can follow the exit while the chunk loads, then the entrance plays — sequential exit → blank → enter reads as jank even at 60fps.
2. **Animating the whole page container** — the transition moves `opacity` + `y` on a div wrapping the entire `Page`, whose parchment/kraft textures are data-URI SVGs with `feTurbulence` filters; compositing those while translating a full-viewport container forces expensive repaints per frame.
3. **Full remount per pathname** — the `key={pathname}` div remounts the whole page tree each navigation, so mount-time data loads and renders run *during* the entrance animation, contending with it on the main thread.

Fix direction, to be confirmed by a quick profile first: crossfade or opacity-only (no `y`, nothing that moves the textured surface), drop `mode="wait"` so enter doesn't queue behind exit, and no blank Suspense frame. If the honest answer is that the page transition buys nothing, removing it entirely is in-bounds — UX principles already say motion restraint. Simplify what stays: one shared transition config instead of per-file inline `{ duration, ease }` objects, reduced-motion handling preserved, and any animation CSS can do alone (the refresh-button spin) loses its framer dependency.

**Phase 1 findings** (static/code analysis — this environment has no browser, so the Performance-panel repro was done by tracing render/mount behavior in source instead):

1. **`mode="wait"` — CONFIRMED, and doubled.** `router.tsx`'s `AnimatePresence mode="wait"` forces every navigation through a strict exit(200ms) → mount → enter(200ms) sequence — a mechanical ~400ms floor on every page switch, independent of frame rate. `sidebar-shell.tsx` has a second, unsynced `mode="wait"` `AnimatePresence` keyed on the same `pathname`, so the sidebar pays its own 200/200ms sequence in parallel — not additive to the page's floor, but a second full unmount/remount cycle on every nav. The blank-Suspense-gap part of this suspect is real but narrow: only `DocsPage`/`SettingsPage`/`TasksPage` are behind `lazy()`, so it only bites on first navigation to those tabs before the chunk is cached; `PlansPage` (the `/` route and all `/plans/$planId`, `/ideas/$ideaId` routes) is eager, so plan/idea switching never sees it.
2. **Textured-container repaint — KILLED as stated.** `Page`'s `parchment` texture (`paper-ui`'s `textures.ts`) is a data-URI SVG with `feTurbulence`, but it's rasterized once at image-decode time and applied as a tiled `background-image`; it is not a live filter re-evaluated per frame. The animated `motion.div` is a *child* of `Page`, animating `opacity`+`y` (`y` compiles to a `transform`), both compositor-only properties — this does not force the browser to re-touch the parent's background bitmap each frame. Not a real cost.
3. **Mount-work during entrance — CONFIRMED, and worse than described.** `key={pathname}` on the router's `motion.div` remounts the full page tree not just on top-nav switches but on *every* plan/idea selection, since `pathname` includes the plan/idea id. Traced through `PlansPage` → `plan-actions-column.tsx` / `plan-filter-column.tsx`: both already derive the active plan/idea reactively via `useActivePlanTitle()`/`useActiveIdeaTitle()` off the router state — they don't need a remount to reflect a new selection. The `SidebarShell`'s independent `key={routeKey}` (same `pathname`) means this sidebar column pays a full exit/unmount/remount/entrance cycle on every single plan click for content that is provably identical before and after (same components, same props shape, just re-deriving from the store). This is confirmed wasted work, not mount-time data loading contending with the animation — the components don't load data on mount here, they just needlessly re-render from scratch.

**Net read:** the `mode="wait"` exit-then-enter floor (suspect 1) and the needless full-tree remount on every plan/idea click (suspect 3, sharper than originally framed) are the real causes of "doesn't feel smooth" — every list click pays ~400ms of forced sequencing plus two full component-tree teardown/rebuilds for content that didn't conceptually change. Suspect 2 (textured repaint) is not a contributor. Fix direction for phase 2 should prioritize: dropping `mode="wait"` (crossfade, no exit-blocks-enter), and re-keying `SidebarShell`'s `AnimatePresence` off something coarser than raw `pathname` (e.g. area/`isPlansArea` vs `isDocsArea`) so plan/idea switches don't remount sidebar content that isn't changing.

**Framer usage site inventory (4 files):**
- `router.tsx` — route transition: `AnimatePresence mode="wait"` + `motion.div` (`opacity`+`y`, keyed `pathname`) wrapping `<Outlet/>` inside `Page`.
- `sidebar-shell.tsx` — sidebar content transition: `AnimatePresence mode="wait"` + `motion.div` (`opacity`+`y`, keyed `routeKey`=`pathname`) wrapping sidebar children.
- `stack-panel.tsx` — two usages: (a) `AnimatePresence` (no `mode`) + `motion.div` (`opacity`+`x`) for the collapsed reopen handle, only mounted while closed; (b) always-mounted `motion.div` sliding the panel via `x: isOpen ? 0 : '100%'` — transform-only, real work, no remount involved. This is the one animation doing something a page-transition-style approach can't cheaply replace.
- `refresh-button.tsx` — `motion.span` animating `rotate` 0→360 in an infinite loop while `refreshing`, purely decorative; a CSS `@keyframes` spin class would do this without a framer dependency.

### Phases
- [x] Profile and pin the cause
      Reproduce the lag with the Performance panel against the live dev server; confirm or kill the three suspects (mode="wait" sequencing, textured-container repaint, mount-work during entrance) and inventory all 4 framer usage sites.
- [x] Fix the route transition
      Apply what the profile says: opacity-only crossfade without mode="wait" and without a blank Suspense gap — or remove the transition if that's what smooth requires. Keep reduced-motion behaviour.
- [x] Simplify the remaining usage
      One shared transition config; downgrade framer usage that plain CSS covers; keep the Stack panel slide (it's the one animation doing real work).
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, tests green; page switches verified smooth in Chrome against the dev server on the real pages, not a synthetic demo.
