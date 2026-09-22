---
id: IDEA-284
title: A page for a roadmap item
type: feat
status: idea
created: 2026-09-22
tags:
  - app
  - ui
  - roadmap
subject: Planning surface
order: 1
---

A roadmap item opens in place. Expanding a row drops its description,
its action row, a candidate field, its open ideas and a *shipped* fold
into the middle of the list, so the list turns into a ragged column of
half-open drawers and the item still cannot be read: the description is
one truncated line in the row and a paragraph in the fold, the ideas are
titles with no state beyond a stamp, and the four verbs sit between a
text field and the next horizon. An item is an entity with a story, like
an idea, and it gets the same thing an idea has — a page.

**A row opens a page.** `/roadmap/$item`, the item's name URL-encoded,
is a corpus-layer route rendered inside `RoadmapPage` the way
`/ideas/$ideaId` renders inside the plans page; the sidebar stays. The
`Accordion` goes: a row is a `Row` with the whole row as its click
target, and nothing renders into the list but rows. `PageBreadcrumb`
derives *Roadmap › <horizon> › <item>*, with *Roadmap* navigating back.

**The head card.** The name as the page title, the state `Stamp` and
the count — *3 of 5 · 2 open*, or *ready to ship* — on the same line,
then the item's full description as body text with paragraphs, then a
facts line: the horizon, the date of the item's earliest linked idea
(*Since*), and the date of the latest (*Last idea*).

**Every linked thing, in three sections.** *Open*: ideas that are not
done or dropped, as rows with id, title, status stamp and progress —
*4 / 5* for a plan with phases, *drafted* for an idea with none —
sorted in-progress first, each opening the idea. *Thoughts*: the item's
candidate bullets, renamed everywhere the user reads them — the section,
the field *Add a thought*, the stamp on the list row, the promote modal
— while the file grammar and `candidates` in code stay as they are. Each
thought has *Promote* and *Remove*. *Shipped*: done and dropped ideas,
folded to a count that expands to the same rows.

**Actions on the bottom bar.** *Edit*, *Move* and *Mark shipped* (or
*Reopen*) on the left as they are on the row today, *Remove* beside them
in the danger tone; *Promote to idea* on the right as the primary. Remove
navigates back to the roadmap. The list row itself carries no actions.

**The list gets simpler for it.** With no expanded state, `RoadmapItemRow`
loses `expanded`, `highlighted` scroll-into-view and the fold; a
`?item=` deep link now opens the page instead of expanding a row, and the
row's *thoughts* count joins its state column as a muted `Stamp`.
`StandingConcernRow` opens the same page for a concern, whose head card
has no state, no verbs but *Edit*, and whose sections are the same.

### Out of scope

Editing a thought's text. Reordering ideas within a section. Anything
the item's ideas themselves show.

### Phases
- [ ] Add the `/roadmap/$item` route and breadcrumb
      Render `RoadmapPage` at the new corpus-layer route, turn the `?item=`
      search param into a redirect to it, and derive the trail in `PageBreadcrumb`.
- [ ] Build the item page shell and head card
      A view and hook that resolve the item or standing concern by name, with
      title, state stamp, counts, description and the facts line.
- [ ] Render the Open, Thoughts and Shipped sections
      Includes renaming candidates to thoughts in every user-facing string,
      the promote modal among them.
- [ ] Wire the bottom action bar
      Edit, Move, Mark shipped/Reopen, Remove and Promote to idea, reusing the
      roadmap page's modals; Remove navigates back.
- [ ] Strip the expanded state from the list rows
      `RoadmapItemRow` drops the accordion, fold and highlight scroll and gains
      the thoughts stamp; `StandingConcernRow` links to the page.
