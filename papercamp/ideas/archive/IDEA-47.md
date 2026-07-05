---
id: IDEA-47
title: "UI cleanup: style guide and tokens"
type: refactor
status: done
created: 2026-06-19
updated: 2026-06-19
tags:
  - app
  - ui
  - refactor
---

The UI consolidation pass: wrote down the style rules and tokens paper-camp should follow and brought src/app in line with them.

### Phases
- [x] Write CODE_STYLE.md style guide
      Write `CODE_STYLE.md` at the repo root (auto-surfaces in the Docs page's "Repo Docs" section via the existing `/api/docs` endpoint — no new doc-type plumbing needed): paper-ui-only component usage (raw HTML only when paper-ui has no equivalent, and say so inline with a comment), consuming paper-ui's font/spacing tokens instead of hardcoded literals, a "3 copies = extract" rule for shared logic consistent with this project's existing no-premature-abstraction stance, and the feature-folder/services-layer organization the codebase already follows implicitly
- [x] Extract useProjectIdentity hook
      Extract a shared `useProjectIdentity()` hook (icon + project name) consolidating the 5 duplicated fetch sites into one
- [x] Extract LinkButton and status map
      Extract a shared `LinkButton` component for the 3x-repeated inline link-button style; collapse `STATUS_COLOR`/`STATUS_BAR_COLOR` into one map in `plans/constants.ts`
- [x] Swap raw elements for paper-ui
      Swap remaining raw/custom elements for paper-ui equivalents: `IconButton` for the Stack panel's toggle/close buttons, `docs-search.tsx`'s result row, and `focus-phase-item.tsx`'s copy button; log the file-input gap as a real paper-ui gap (open question, not a workaround built here)
- [x] Adopt paper-ui font and spacing tokens
      Adopt paper-ui's font-family and spacing tokens project-wide, replacing the ad-hoc literals — either consume paper-ui's CSS custom properties directly if exposed, or mirror them exactly in one local constants file to kill the drift
- [x] Fix root layout spacing
      Layout spacing pass over the root layout (`router.tsx`'s sidebar/content/stack-panel grid, page padding, nav island positioning) using the now-established scale — fix the specific spacing issues already visible, not a redesign
- [x] Add framer-motion animations
      Add `framer-motion` and use it for simple, restrained motion: route-level transition, list/feed items animating in (especially the Stack panel's live activity feed), and replacing the hand-rolled `translateX`/`transition` CSS in `router.tsx`/`stack-panel.tsx` with its declarative equivalents
