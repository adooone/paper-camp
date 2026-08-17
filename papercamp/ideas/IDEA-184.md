---
id: IDEA-184
title: One row treatment on the Plans page
type: fix
status: in-progress
created: 2026-08-16
updated: 2026-08-17
tags:
  - app
  - plans
  - ui
subject: App UI
order: 9
---

The Plans page renders the same entities two different ways and offers two
creation actions that look nothing alike.

### Archive rows ignore the worklist grid

A worklist row computes to `76px 255.75px 84px 96px 112px` — a five-column grid
the header shares to the pixel (measured at x `410, 496, 763, 857, 964`). An
archive row in "Ready to archive" computes to `display: flex` with no grid at
all: id, title, and an Archive link, no gutter, no Updated, no Progress, no
status stamp.

Two treatments of the same entity type, stacked on one page, sharing no column
boundaries. An entity that was a five-column row a moment ago becomes a flex
strip once it is done.

Archive rows adopt `PLAN_ROWS_GRID_CLASS` and the row-marker gutter, with
Archive occupying the Status column's position. They keep their distinct
texture — being done should read differently — but the columns line up, so the
eye tracks one table down the page rather than two.

### The archive section ignores the search

Filtering down to *"Nothing matches these filters"* still leaves four archive
rows visible below that message. The section reads as part of the list, so
exempting it from the filter makes the empty state look wrong.

Apply the search to it, and when it is filtered to nothing, drop the section
rather than showing an empty heading with a count.

### Two create actions, one legible

`NewIdeaButton` is a paper-ui `Button` with an icon *and* the label "New idea".
`AddToBacklogButton` sits immediately beside it as a bare `IconButton` behind a
tooltip. They post to different endpoints — `POST /api/ideas` and
`POST /api/plans` — and nothing on screen says which is which without hovering.

Give them matching affordance: both labelled, or both icons with the labels in
an overflow. The stronger question is whether two entry points still earn their
place now that every entity is idea-shaped until phases are drafted into it —
"New idea" with its note switch already covers the plain case, and the second
button's `kind` select is the only thing it adds. Settle that first; if one
goes, the asymmetry goes with it.

### Out of scope

The create modals' own fields, and the status-filter and sort behaviour
([[IDEA-183]]).

### Phases
- [x] Grid-align the archive rows
      Give archive rows PLAN_ROWS_GRID_CLASS and the row-marker gutter, with Archive in the Status column slot.
      run: 1m12s · 5.7k in · 5.1k out · sonnet-5
- [x] Preserve the done texture within the grid
      Keep the distinct archive-row look while the five columns line up with the worklist header.
      run: 1m6s · 368 in · 3.8k out · sonnet-5
- [x] Filter the archive section with the search
      Run the archive rows through the same filter and drop the whole section when nothing matches.
      run: 1m13s · 507 in · 4.5k out · sonnet-5
- [x] Decide whether both create actions stay
      Settle whether the second entry point earns its place before touching either button.
      run: 26s · 5.6k in · 1.3k out · sonnet-5
- [x] Remove the Quick plan action, keep New Idea as the single create entry point
      Delete AddToBacklogButton and its POST /api/plans creation path; every new entity is created as a plain idea (idea/note kind) via NewIdeaButton and gets typed later when drafted into a plan.
      run: 1m54s · 658 in · 6.9k out · sonnet-5

### Fixes
- [x] Match done row height to regular card height
      Archive/done rows in the worklist currently render shorter than a normal idea card. Align their height (padding/line-height) with the standard row so done items don't visually shrink.
      run: 3m17s · 5.9k in · 13.8k out · sonnet-5
- [x] Always sort in-progress ideas to the top
      Regardless of the active sort column, ideas with status in-progress should be pinned first in the list ordering.
      run: 1m28s · 288 in · 5.3k out · sonnet-5

### Thread
- [x] 2026-08-17 [question] [agent] Run-all parked on phase 4 ("Decide whether both create actions stay") — the agent needs a decision: Does the "Quick plan" entry point (`AddToBacklogButton` → `POST /api/plans`, letting you pick a typed `kind`: feat/fix/chore/docs/refactor at creation) still need to exist as a separate one-step action, or should every new entity start as a plain idea via `NewIdeaButton` (→ `POST /api/ideas`, kind idea/note only) and get typed later when it's drafted into a plan? This determines whether phase 5 gives matching affordance to two buttons or removes one — it's a scope call on the creation workflow, not something I can infer from the code.
- [x] 2026-08-17 [clarification] every new entity start as a plain idea
- [x] 2026-08-17 [chat] [agent] Locked in — every new entity starts as a plain idea via New Idea. That means Quick plan / AddToBacklogButton goes away, so phase 5 becomes: remove the Quick plan action and give New Idea its full treatment.
- [x] 2026-08-17 [chat] height of the done item is not the same as regular idea card in the list. Also while we here - make in progress ideas always on top
- [x] 2026-08-17 [chat] [agent] Added both here as fixes: match the done row's height to a regular card, and pin in-progress ideas to the top of the sort order. (reopened this idea to re-run)
