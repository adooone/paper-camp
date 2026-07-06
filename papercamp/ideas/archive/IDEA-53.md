---
id: IDEA-53
title: Fix Review status bugs
type: fix
status: done
created: 2026-06-21
updated: 2026-06-21
tags:
  - app
  - plans
  - core
---

Fixed the five correctness bugs code review found in the Review status work.

### Phases
- [x] Reset active selection on page change
      `activePlanTitle`/`activeIdeaTitle` are global Zustand state shared by `PlansPage`
      and the new `ReviewPage`, with neither clearing it on navigation — opening a plan
      on one page and switching to the other via the nav bar (not its own back button)
      renders that same plan's detail regardless of status. Clear both on route change,
      or scope the selection per-route.
- [x] Gate Start button on review status
- [x] Support multi-line Log entries
- [x] Disable phase checkboxes while updating
- [x] Demote review plans when starting a new one
- [x] Remove duplicate Review stamp
- [x] Extract shared section-parsing helper
      `extractLog` in `src/core/parser.ts` copy-pastes `extractPhases`'s
      heading-search/boundary-scan/remainder-slice logic almost verbatim — factor out a
      shared `extractSection(body, headingRe, parseEntry)` before a third markdown
      sub-section repeats the duplication.
