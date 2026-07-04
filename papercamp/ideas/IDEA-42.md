---
id: IDEA-42
title: Plans list filters and sorting
---

## IDEA-42: Plans list filters and sorting

FEAT-37's dense rows made plans scannable, but navigation is still scroll-by-section: In progress/Backlog headings, a separate paginated Closed section, and no way to slice the list by intent. Replace sections with one all-status list driven by a sticky filter/sort card.

- **One flat list, every status.** `list-view.tsx` renders a single `plan-rows.tsx` list containing all plans — in-progress, review, planned, backlog, done, dropped — replacing the In progress/Backlog section split and retiring `closed-section.tsx`. Default sort: status precedence (in-progress → review → planned → backlog → done → dropped), then updated date. A windowed "show more" (or done/dropped chips defaulting off) guards against 40+ done plans dominating first paint — decide at plan time.
- **Filters and analytics are the same element.** A sticky `Card` (kraft, matching the list header) pinned below the app header: status chips carrying live counts ("In progress 1 · Review 2 · Done 40") that toggle as filters — the counts *are* the quick analytics; the top few tags as clickable count-stamps with the rest behind an overflow; a search input matching title/body. Optionally one derived line counts can't say (plans unaudited since last change).
- **Sorting lives in the same card.** A compact sort control: status precedence (default), updated, created, title, id, phase progress — with direction toggle. Applies to the rows list; the board view keeps its own fixed lanes.
- **Toolbar absorbs into the card.** `list-toolbar.tsx`'s Audit-all, view toggle, and Add-to-backlog join the sticky card so the page has one control surface instead of two.

Builds directly on FEAT-37's row-card list (from [[IDEA-38]]); no storage or API changes — pure client-side filtering/sorting over the already-loaded `plans.entries`. [[IDEA-43]] extends the same list with idea grouping, so keep the filter/sort logic factored to survive rows becoming a two-level tree.
