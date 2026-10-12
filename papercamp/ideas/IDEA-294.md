---
id: IDEA-294
title: A compact Ideas toolbar and list
type: feat
status: planned
created: 2026-10-12
tags:
  - app
  - ui
  - plans
  - roadmap
needs:
  - paper-ui/IDEA-13
subject: App UI
order: 3
---

The Ideas page header doesn't hold still. Under the title sit three
lines of controls: the search with a four-button *Group by*, then a row of
status stamps whose width grows with their counts, then *Clear filters*. The
block changes height as statuses appear and as the window narrows. *Horizon*
sits among the grouping buttons, but it's no grouping: it swaps the list for
the roadmap, a different thing. The list's header row is the same parchment
card as every row under it, so it reads as one more idea. Its run-order
`#▲` floats in the gutter outside it, and its sort arrows are bare glyphs
appended to the labels. The sidebar's filled full-width rows read as a
menu, not as filters. The roadmap belongs to one project, so it moves to the
Project page.

**One toolbar row.** Under the title row (*Ideas*, *New idea*, ⋯) there is
exactly one toolbar row, 32px tall, which never wraps: the search input
(`flex-1`, `min-w-[140px]`, *Search ideas…*) and a compact *Group* `Select`
reading *Group: Subject*, with the options Plain, Subject and Project.
*Project* is listed only when more than one project is in scope. `?group=`
keeps the choice. There is no sort control in the toolbar; sorting lives in
the list header. `GroupByControl`'s buttons are deleted.

**Status filters move to the sidebar.** On the Ideas list the sidebar holds
two sections: *Projects in view* (with *All* · *Clear*), then *Status* (with
*Clear*, shown when the statuses differ from the default). Each status is a
row: a paper-ui `Checkbox size="small"` labelled with the status, and its
count right-aligned in the muted 2xs face. Unchecked rows show their label in
the secondary tone. They cover the same six statuses in the same order with
the same defaults as the old stamps. `PlansToolbar` loses its stamp row.

**Every sidebar filter is a checkbox row.** `ScopeProjectRow` in list mode
becomes the same small checkbox row: checkbox, project name truncating with
an ellipsis, count. The current project's box is checked and disabled. The
filled `SidebarItem` look stays only for navigation: the Project page's
project switcher, Docs, Stats, Settings and *All machines*.

**The roadmap moves to the Project page.** It lives at `/project/roadmap`,
and an item at `/project/roadmap/$item`. The Project sidebar opens with a
*Roadmap* section above Docs: an *Overview* navigation item, then one
small-checkbox row per horizon with its item count, filtering the page as
`RoadmapSidebar`'s horizon chips did. The page's title row is *Roadmap* with
*+ Add item*. Its one toolbar row is *Search roadmap…*. Under it come the
horizon sections, standing concerns and unfiled ideas, as *Group by Horizon*
renders them today. The item page's breadcrumb reads *Roadmap › <horizon> ›
<item>*. *Horizon* leaves the Ideas grouping. With several projects in scope
the roadmap shows the current project's only. `/?group=horizon`, `/roadmap`
and `/roadmap/$item` redirect to the new addresses.

**A kraft header that sorts.** The list's header is a
`<Row surface="card" texture="kraft">`, using paper-ui's new `Row` texture
prop, one fixed 32px band on the darker paper, using the same `PLAN_ROW_COLUMNS`
as the rows. The run-order `#` becomes its first cell, over the run-order
stamps, instead of floating in the gutter. Every label is the sort button for
its column. The active column's label is semibold and carries a 12px arrow
icon (down for descending, up for ascending), and clicking it again flips
the direction. Inactive labels carry no arrow. Labels keep their column's
alignment, so Phases and Status stay right-aligned over their values.
`aria-sort` stays on each header cell.

Done when the Ideas header is the same height with every status shown, the
roadmap opens from the Project sidebar, and every sidebar filter is a
checkbox row.

### Out of scope

Sorting the roadmap. Filters on Activity. The Stack panel.

### Phases
- [ ] Bump paper-ui to the small checkbox and row texture release
      Raise the `@dendelion/paper-ui` range to the version that ships
      IDEA-13 and install it.
- [ ] Turn sidebar filters into checkbox rows
      Small-checkbox rows for Projects in view in list mode, and a Status
      section with counts and Clear on the Ideas list; status stamps leave the
      toolbar.
- [ ] Cut the Ideas toolbar to one row
      Search plus the Group select (Plain, Subject, Project when scoped);
      Horizon leaves grouping; GroupByControl deleted.
- [ ] Move the roadmap to the Project page
      `/project/roadmap` and its item route, the sidebar Roadmap section with
      horizon checkboxes, the one-row page toolbar, breadcrumbs, and redirects
      from `/?group=horizon` and `/roadmap/…`.
- [ ] Put the list header on kraft and sort from its labels
      `Row surface="card" texture="kraft"` header with the `#` cell inside,
      label buttons with the arrow icon on the active column, aria-sort kept.
