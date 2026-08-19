---
id: IDEA-183
title: Filters and sort tell the truth
type: fix
status: review
created: 2026-08-16
updated: 2026-08-19
tags:
  - app
  - plans
  - ux
subject: Planning surface
order: 5
---

The Plans worklist's two controls both misreport: the status filter deletes
options while you search, and the sort indicator claims an order the page does
not render.

### Searching removes filter chips

`plan-filter-column.tsx` keeps a chip only when
`statusCounts[status] > 0 || activeStatuses.has(status)`. So an unselected status
whose count drops to zero is removed from the DOM entirely. Measured live:

| | chips shown |
|----|----|
| no search | In progress, Review, Planned, Idea, **Done**, **Dropped** |
| search `zzzznomatch` | In progress, Review, Planned, Idea |

Done and Dropped disappear precisely when a search has found nothing and
widening it is the obvious next move. "In progress" survives at zero only
because it happens to be selected, which makes the rule look arbitrary from the
outside.

The chip list is navigation, not a result set. Render every status in
`STATUS_CHIP_ORDER` whenever plans exist, show the count as `0`, and keep it
clickable — selecting a zero-count status is how you discover there is nothing
there, and it is already how the four selected chips behave.

Hiding a status that genuinely has no entities in the whole corpus is a separate
question; if that is still wanted, gate it on the unfiltered total rather than
on the search-filtered count, so typing never changes which options exist.

### The sort indicator claims an order the page does not use

The `#` column carries `aria-sort="ascending"`, but `groupRowsBySubject` runs
*after* the sort, so the gutter renders `1, 2, 4, 5, 3, 9, 6, 7, 8`. While more
than one subject exists — `showSubjectHeaders = groups.length > 1` — clicking
`#` flips a direction that grouping immediately overrides. The control is live,
the indicator is active, and neither can produce a run-ordered list.

Sorting and grouping are two different intents fighting over one surface. Make
grouping explicit and defeatable: subject grouping becomes a toggle, and
choosing a sort column turns it off, so the order on screen is always the order
the header claims. `aria-sort` must never be set on a column whose ordering is
not what the rows show — a screen reader is told "ascending" and gets nothing of
the kind.

### Out of scope

What the sort comparators rank by, the subject vocabulary itself, and the
archive section's own filtering ([[IDEA-184]]).

### Phases
- [x] Render every status chip whenever plans exist
      In `plan-filter-column.tsx`, iterate `STATUS_CHIP_ORDER` unconditionally, drop the `statusCounts[status] > 0 || activeStatuses.has(status)` guard.
      run: 40s · 5.7k in · 1.9k out · sonnet-5
- [x] Show zero counts as clickable `0` chips
      Keep unselected zero-count chips enabled so selecting one reveals the empty result.
      run: 30s · 228 in · 1.6k out · sonnet-5
- [x] Gate whole-corpus hiding on the unfiltered total
      If a genuinely empty status should still hide, key it off the pre-search corpus count, never the filtered count.
      run: 55s · 239 in · 3.9k out · sonnet-5
- [x] Make subject grouping an explicit toggle
      Replace the implicit `showSubjectHeaders = groups.length > 1` with a user-controlled toggle.
      run: 1m48s · 517 in · 7.1k out · sonnet-5
- [x] Turn grouping off when a sort column is chosen
      Selecting a sortable header disables grouping so rendered order matches the header.
      run: 1m40s · 229 in · 2.8k out · sonnet-5
- [x] Set `aria-sort` only when rows reflect it
      Emit `aria-sort` on the `#` column only while grouping is off and the gutter is truly sorted.
      run: 1m3s · 238 in · 3.4k out · sonnet-5

### Fixes
- [x] Move grouping toggle above the list with handwritten styling
      The subject-grouping toggle currently sits inline in the column-header row next to the sort titles, which reads as a stray control. Move it above the list (its own row, not mixed with column headers) and style it with the app's handwritten font treatment instead of a plain button.
      run: 1m5s · 5.7k in · 4.3k out · sonnet-5
- [x] Move grouping toggle into the header actions row
      Relocate the subject-grouping toggle out of its own row and into the existing actions row above the table (alongside New idea and other list actions), keeping the handwritten-font styling.
      run: 1m55s · 6.1k in · 7.2k out · sonnet-5

### Thread
- [x] 2026-08-19 [chat] why this awful button placed directly into list header with column titles. It should be above the list and with handwritten font
- [x] 2026-08-19 [chat] [agent] Added that as a fix here — moving the subject-grouping toggle above the list (out of the column-header row) and styling it with the handwritten font instead of a plain button in the header. (reopened this idea to re-run)
- [x] 2026-08-19 [chat] we have a row above table with new idea and other actions, why you cant put this button here? Why do I need to explain such simple things
- [x] 2026-08-19 [chat] [agent] Fair — added it here as a phase to put the toggle in the header actions row (where New idea and the other controls already live), not a separate row above the list. (reopened this idea to re-run)
