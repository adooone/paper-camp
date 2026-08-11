---
id: IDEA-152
title: Strip animations to a static baseline
type: refactor
status: done
created: 2026-08-11
updated: 2026-08-11
tags:
  - app
  - ui
subject: App UI
---

To redesign motion deliberately later, remove every animation the app
currently has rather than tune them one at a time. State changes become
instant, not differently-animated — this is a bare baseline, not a
re-skin.

1. **framer-motion goes entirely**, from all three consumers: the routed
   page's crossfade on navigation (`router.tsx`), the sidebar's
   fade+slide-in on route change (`sidebar-shell.tsx`), and the Stack
   panel's two animations — the closed-state reopen tab's fade/slide and
   the panel's own open/close drawer slide (`stack-panel.tsx`). The
   shared `crossfadeTransition`/`crossfadeVariants` helpers
   (`styles/motion.ts`) go with them, and so does the `framer-motion`
   dependency itself once nothing imports it.

2. **Tailwind transition/animate utilities go too**: the mobile drawer's
   slide (`sidebar-shell.tsx`), the refresh icon's spin
   (`refresh-button.tsx`, plus the `pc-spin` keyframe/animation entry in
   `tailwind.config.ts`), the phase-run chevron's rotate
   (`tasks-page.tsx`), and the agent-start button's opacity transition
   (`agent-start-button.tsx`). Toggled UI (drawer open/closed, chevron
   expanded/collapsed) still toggles — it just snaps instead of easing.

3. **`useReducedMotion()` checks are removed with their animations** —
   they exist only to null out motion that no longer exists.

4. **Not in scope**: paper-ui's own internal motion (button wobble,
   toast slide-in, etc.) — this idea is paper-camp's app layer only.

### Phases
- [x] Drop framer-motion from the routed page and sidebar
      Remove the crossfade in `router.tsx` and the route-change fade/slide in `sidebar-shell.tsx`.
      run: 1m14s · 5.9k in · 4.1k out · sonnet-5
- [x] Drop framer-motion from the Stack panel
      Remove the reopen tab's fade/slide and the panel's open/close drawer slide in `stack-panel.tsx`.
      run: 1m10s · 230 in · 4.7k out · sonnet-5
- [x] Delete the crossfade helpers and the framer-motion dependency
      Remove `styles/motion.ts` and drop `framer-motion` from package.json once nothing imports it.
      run: 1m4s · 240 in · 1.9k out · sonnet-5
- [x] Snap the Tailwind-animated UI
      Remove the mobile drawer slide, chevron rotate, and agent-start opacity transition so they toggle instantly.
      run: 54s · 364 in · 2.6k out · sonnet-5
- [x] Remove the refresh spin and its keyframe
      Strip the spin in `refresh-button.tsx` and the `pc-spin` entry in `tailwind.config.ts`.
      run: 50s · 234 in · 1.7k out · sonnet-5
- [x] Sweep out orphaned useReducedMotion checks
      run: 1m2s · 374 in · 2.8k out · sonnet-5

### Thread
- [x] 2026-08-11 [decision] Full removal, not tuning — a clean baseline to design motion back onto deliberately later, not a pass that keeps some animations and cuts others.
