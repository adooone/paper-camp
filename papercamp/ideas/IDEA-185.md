---
id: IDEA-185
title: Delete the idea-group machinery
type: refactor
status: idea
created: 2026-08-16
updated: 2026-08-17
tags:
  - app
  - plans
  - refactor
subject: Code health
---

The worklist carries a whole parent/child rendering path that cannot execute.
Deleting it removes the most complex branch on the page.

### Why it is unreachable

`selectWorklistRows` builds `ideaParents = ideas.filter((idea) => idea.kind !== 'note')`
from the store's `ideaEntries`, which comes from `/api/ideas`. That endpoint now
returns **only `kind: note` entities** — verified live: one entry, kind `note`.
So `ideaParents` is always empty, the loop that pushes `type: 'idea-group'`
never runs, and no idea-group row can reach the renderer.

The second door is shut too: grouping needs a child plan whose `idea:`
frontmatter names a parent, and **zero entities in the corpus carry that field**.
`childrenByIdea` is always empty, so every plan falls into `orphanPlans` and
renders as `type: 'plan'`.

This is the unified-entity model ([[IDEA-43]]) having landed — an idea *is* its
plan, so there is no parent to group under. The rendering path outlived the
data model it was written for.

### What comes out

- `IdeaGroupRowCard` (~70 lines in `worklist-rows.tsx`) and the `IdeaGroupRow`
  type
- the `childrenByIdea` / `orphanPlans` partition in `plan-list-selector.ts`, and
  the `ideaParents` loop — every plan is an orphan, so the split has one branch
- `DONE_COLLAPSE_THRESHOLD`, the `expandedDone` `Set`, `toggleExpanded`, and the
  "+N done" toggle, whose only caller is the group card
- the group card's own `grid-cols-[76px_minmax(0,1fr)_84px_1fr]` — a four-column
  template that never matched the five-column header, and would have misaligned
  had it ever rendered

Confirm `DraftPlanButton` and `ExtendIdeaButton` keep their other call sites
before removing the group card that also mounts them.

### Three smaller ones in the same files

- **`PLAN_ROWS_GRID_CLASS` is declared twice**, byte-identical, in
  `plan-rows.tsx` (exported) and `worklist-rows.tsx` (local). `worklist-rows`
  already imports from `plan-rows`, so it is shadowing a constant it could take.
  Two copies of a column template is exactly how a header stops matching its
  rows.
- **`ROW_MARKER_WIDTH` is exported, imported, and never used.** `RowMarker` and
  the worklist both hardcode `flex-[0_0_36px]` instead. Either use it or drop it;
  knip cannot see it because the unused import counts as a consumer.
- **`PlanRows`'s `showHeader` branch is dead.** Both call sites pass
  `showHeader={false}`, so the default `true` and the 15-line header block it
  guards never render. The live header is the sortable one in `worklist-rows`.

### Out of scope

Anything that changes what the worklist shows. This is a removal: the rendered
output must be identical before and after, which is what makes it safe to do in
one pass.

### Carve-out: the `idea:` field survives

[[IDEA-187]] makes the `idea:` backlink load-bearing — it is how a fix entity
points at the idea it fixes. So the evidence above ("zero entities carry that
field") is true today and stops being true once 187 ships.

Delete the parent/child **rendering** only. `idea:` stays in the schema and in
`EntityEntry`, untouched. A fix renders as its own row in the worklist rather
than as a nested child card, so nothing IdeaGroupRowCard did comes back — but
the field it keyed off is about to carry real weight.

Run this idea before [[IDEA-187]], with that carve-out explicit in the removal.

### Phases
- [ ] Confirm shared call sites survive
      Verify `DraftPlanButton` and `ExtendIdeaButton` are mounted elsewhere before deleting the group card.
- [ ] Collapse the selector partition
      Drop the `ideaParents` loop and `childrenByIdea`/`orphanPlans` split in `plan-list-selector.ts`; every plan becomes a plain row.
- [ ] Remove the group card and its state
      Delete `IdeaGroupRowCard`, the `IdeaGroupRow` type, `DONE_COLLAPSE_THRESHOLD`, `expandedDone`, `toggleExpanded`, and the "+N done" toggle.
- [ ] Fold the three duplicate/dead-code cleanups
      Share `PLAN_ROWS_GRID_CLASS` from `plan-rows`, resolve `ROW_MARKER_WIDTH`, and drop the dead `showHeader` branch in `PlanRows`.
- [ ] Verify identical output and run checks
      Confirm the worklist renders the same before and after, keeping `idea:` in the schema; run quality, tests, and consistency checks.
