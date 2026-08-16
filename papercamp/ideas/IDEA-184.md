---
id: IDEA-184
title: One row treatment on the Plans page
type: fix
status: idea
created: 2026-08-16
updated: 2026-08-16
tags:
  - app
  - plans
  - ui
subject: App UI
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
