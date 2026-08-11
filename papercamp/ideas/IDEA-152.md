---
id: IDEA-152
title: Strip animations to a static baseline
type: refactor
status: idea
created: 2026-08-11
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

### Thread
- [x] 2026-08-11 [decision] Full removal, not tuning — a clean baseline to design motion back onto deliberately later, not a pass that keeps some animations and cuts others.
