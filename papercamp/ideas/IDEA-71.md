---
id: IDEA-71
title: Run order for the worklist
type: feat
status: review
created: 2026-07-17
tags:
  - app
  - plans
  - ideas
  - ui
---

The worklist answers "what exists" but not "what do I run next" — sequencing lives only as prose inside idea bodies ("sequence after [[IDEA-68]]"), invisible in the list. Give ideas an explicit run order instead of a priority enum or a dependency graph: both of those are ceremony, and the actual need is a queue the user can see and adjust.

Design follows the [[IDEA-70]] subject pattern: one optional frontmatter key, virtual default, no file migration.

- **`order:` frontmatter** — optional integer; absent means "unordered".
- **Worklist sorting** — ordered ideas first (ascending), unordered below by created date. This becomes the default sort; [[IDEA-64]]'s column-header sorting keeps working, with order as just another sortable column. When [[IDEA-70]]'s subject groups land, order applies within a group.
- **Setting the order** — up/down controls on the row (swap with the neighbour, writing only the two `order:` lines involved) plus a plain field in the detail view. No drag-and-drop; two arrows cover the need without a new interaction model.

### Phases
- [x] Add the order field to entities
      Optional `order:` integer frontmatter — types, parser, serializer round-trip with tests; absent key sorts as unordered, no migration.
- [x] Sort the worklist by run order
      Ordered first ascending, unordered after by created date, as the default sort; keep [[IDEA-64]] header sorting intact with order as a sortable column.
- [x] Set the order from the UI
      Up/down controls on the worklist row (neighbour swap, minimal frontmatter writes) and an order field in the idea detail view.
- [x] Gate the pass
      `tsc --noEmit`, `biome check`, tests green (round-trip + sort covered); reorder a few ideas in the app and confirm the list and files agree.
