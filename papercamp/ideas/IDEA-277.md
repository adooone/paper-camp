---
id: IDEA-277
title: Managing roadmap items
type: feat
status: idea
created: 2026-09-21
tags:
  - app
  - core
  - server
  - roadmap
subject: Planning surface
order: 3
---

The page can add an item, add a candidate, and promote. It cannot change
anything that exists: a misnamed item, a bet that moved from Horizon 3 to
Horizon 2, a finished item, an abandoned one — each means opening
`ROADMAP.md` by hand. `removeRoadmapItem` has sat in core with no route
and no caller, and nothing at all marks an item finished, which is why
Packaging still reads as unstarted months after it shipped.

**Four verbs on the expanded item's action row.** *Edit* opens the
add-item modal prefilled, saving the name and description. *Move* is a
`Menu` of the other horizons. *Mark shipped* closes the item; on a shipped
item it reads *Reopen*. *Remove* deletes it after a confirm that names the
item and says its ideas keep their subject. Candidates gain *Remove*
beside *Promote*.

**Shipped items stay in the file.** *Mark shipped* appends
`  - ✓ shipped <today>` under the item, the bullet [[IDEA-275]] parses into
`shippedOn`; *Reopen* deletes that bullet. The item keeps its horizon, its
description and its links, so the map remains a record of what was bet and
when it landed, and the page folds it into the horizon's *Shipped* row.
The file's *How this file works* section is rewritten to say so, replacing
the line that says the file is pruned when an item graduates.

**A rename carries its ideas.** An item's name is the `subject:` of every
idea filed under it, so *Edit* with a changed name rewrites that
frontmatter field in each of those entities, archive included, in the same
request, and the confirm line says how many: *Renames the subject of 30
ideas.* Without that, a rename would silently empty the item.

**Core owns the edits.** `updateRoadmapItem`, `moveRoadmapItem` and
`setRoadmapItemShipped` join `removeRoadmapItem` in `src/core/roadmap.ts`,
each a pure function over the markdown with its tests, each moving an
item's continuation lines, candidates, links and marker as one block.
`PATCH /api/roadmap/items` takes `{ horizonTitle, itemName }` with any of
`name`, `description`, `toHorizon`, `shipped`; `DELETE /api/roadmap/items`
removes an item, and `DELETE /api/roadmap/candidates` a candidate. Every
route calls `activity.notifyChanged()`.

### Out of scope

Reordering items within a horizon. Adding, renaming or removing horizons
and standing concerns. Undo beyond git.

### Phases
- [x] Add the three item mutators to core
      `updateRoadmapItem`, `moveRoadmapItem` and `setRoadmapItemShipped` beside `removeRoadmapItem`, each moving the bullet with its continuations, candidates, links and shipped marker as one block, each with tests.
      run: 2m15s · 28 in · 12.9k out · sonnet-5 · sess:ad29beef-d3b1-4baf-81f6-6c3ebc692f26
- [x] Wire the PATCH and DELETE routes
      `PATCH /api/roadmap/items` for name, description, `toHorizon` and `shipped`; `DELETE` for an item and for a candidate; each calls `activity.notifyChanged()`.
      run: 1m27s · 26 in · 7.1k out · sonnet-5 · sess:ad29beef-d3b1-4baf-81f6-6c3ebc692f26
- [x] Carry a rename into every idea's subject
      A changed name rewrites `subject:` in each entity filed under the item, archive included, in the same request.
      run: 1m2s · 18 in · 5.4k out · sonnet-5 · sess:ad29beef-d3b1-4baf-81f6-6c3ebc692f26
- [ ] Put the four verbs on the action row
      Edit through the prefilled add-item modal, Move as a horizon `Menu`, Mark shipped / Reopen, Remove behind a confirm that names the item and counts the ideas it renames; Remove beside Promote on a candidate.
- [ ] Rewrite *How this file works* in `ROADMAP.md`
      Say shipped items stay in the file with their marker, replacing the pruning line.
