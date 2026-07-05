---
id: IDEA-14
title: Review-found phases
type: feat
status: done
created: 2026-06-26
updated: 2026-06-27
tags:
  - app
  - plans
  - agent
---

Let /code-review findings become new unchecked [review]-tagged phases appended to the plan they were reviewed against.

### Phases
- [x] Add `source?: 'review'` to PhaseItem
      Parsed from a small inline tag on the phase's checkbox line (e.g.
      `- [ ] [review] <finding summary>`) rather than a separate markdown section, so
      phases stay one list ordered however they were added
- [x] Resolve the paper-ui Table row-styling gap
      paper-ui's `Table` has no per-row styling hook today, only per-cell `cell` render
      functions — decide between adding a `rowClassName?: (row, index) => string` prop to
      the sibling paper-ui repo, or a paper-camp-only way to fake it from inside a cell
- [x] Render review-found phase styling in plan-detail.tsx
      A small `Stamp`/badge next to the phase title plus the row treatment chosen in the
      previous phase, so a review-found phase reads as distinct without a second table
- [x] Wire /code-review findings into an "Add as phases" action
      Each finding's `failure_scenario`/file:line detail becomes the new phase's
      `description` — same field that already renders in the expandable row for ordinary
      phases
