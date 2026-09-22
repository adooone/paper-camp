---
id: IDEA-282
title: Adopt paper-ui's sketch charts
type: refactor
status: idea
created: 2026-09-22
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 4
---

paper-ui's IDEA-6 ships the four charts this app drew on its own copy of
the generator. Blocked until that release; the first phase bumps the
dependency. Runs after [[IDEA-279]].

**`components/charts/` is deleted.** `hub-numbers-column.tsx` renders the
library's `ArcGauge`, `BarChart` and `StackedBar` with the same props.
`rough-progress-bar.tsx` goes and the roadmap item row renders `Progress
sketch`; the capacity row's `Progress` gains `sketch` too so the two bars
match. `commit-history.tsx` drops `RailLine` and `RailSegment` for
`CommitRail`.

### Out of scope

Any change to what the numbers show.

### Phases
- [ ] Bump paper-ui to the release that ships the charts
- [ ] Render the library charts in `hub-numbers-column.tsx`
- [ ] Swap the roadmap bars for `Progress sketch`
      Covers both the item row and the capacity row so they match.
- [ ] Swap the commit rail for `CommitRail`
- [ ] Delete `components/charts/` and the local generator
      Only after nothing imports them; run the quality checks.
