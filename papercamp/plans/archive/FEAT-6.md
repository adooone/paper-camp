---
id: FEAT-6
title: Build the Stack panel
kind: feat
status: done
created: 2026-06-19
idea: IDEA-3
updated: 2026-06-19
tags:
  - app
  - stack
---

A persistent right-docked, full-height panel present across every page, showing the
active plan and a feed of recent project activity. Default open, toggleable closed,
styled after paper-ui's showcase `DetailSidebar` (chalkboard texture, desk-green
gradient, Luminari header, Luminari section labels). See ideas.md's "The Stack —
right-side status & history panel" for the full feature rationale — entirely buildable
from data/patterns already in the codebase, no new concept of "an agent" required.

### Phases
- [x] Build Stack panel shell
      Panel shell — fixed right-docked, full-height, `translateX` slide transition, chalkboard texture + desk-green gradient, `Luminari` header with a toggle control, default open; added to the root layout (`router.tsx`) alongside the bottom `NavigationIsland`
- [x] Render idle activity history
      Idle state — activity history feed rendering `progress.md` via the existing `/api/progress`, reverse-chronological
- [x] Surface active in-progress plan
      Active state — surface the currently in-progress plan, reusing the existing `findFocusPlan` resolution logic from Focus, plus its phase progress
- [x] Build live activity feed
      Live activity feed — a file watcher (`fs.watch` or `chokidar`) on the dev server, diffing each `papercamp/` file's previously-parsed entries against newly-parsed ones, synthesizing human-readable lines ("phase 2/5 checked off in 'X'", "plan 'Y' marked done", "new open question raised")
- [x] Add SSE activity stream
      Delivery mechanism — a `GET /api/activity/stream` SSE endpoint pushing one event per detected change; panel subscribes and updates live without polling
- [x] Show only current active phase
      Active section shows only the current (first incomplete) phase, not all phases
- [x] Apply font stack rules
      Body font uses Cormorant Garamond; Luminari reserved for titles; section labels use Luminari (was Caveat), sentence case
- [x] Darken chalkboard card background
      Chalkboard Card background darkened to `$color-chalkboard-bg` in paper-ui; used for Active, Live, and all event grouping
- [x] Add empty states
      Empty states for each section (Active, Activity, Live)
- [x] Remove stamp and progress bar
      Stamp and progress bar removed from Active section
- [x] Load Cormorant Garamond font
      Load Cormorant Garamond via Google Fonts in index.html (was referenced by name but never fetched, silently falling back to Georgia/serif)
