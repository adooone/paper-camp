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

### Phases
- [ ] Profile and pin the cause
      Reproduce the lag with the Performance panel against the live dev server; confirm or kill the three suspects (mode="wait" sequencing, textured-container repaint, mount-work during entrance) and inventory all 4 framer usage sites.
- [ ] Fix the route transition
      Apply what the profile says: opacity-only crossfade without mode="wait" and without a blank Suspense gap — or remove the transition if that's what smooth requires. Keep reduced-motion behaviour.
- [ ] Simplify the remaining usage
      One shared transition config; downgrade framer usage that plain CSS covers; keep the Stack panel slide (it's the one animation doing real work).
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, tests green; page switches verified smooth in Chrome against the dev server on the real pages, not a synthetic demo.
