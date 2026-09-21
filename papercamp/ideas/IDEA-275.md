---
id: IDEA-275
title: Truthful roadmap progress
type: fix
status: idea
created: 2026-09-21
tags:
  - core
  - server
  - roadmap
subject: Planning surface
order: 1
---

Every number on the Roadmap page comes from the wrong place. An item's
progress bar counts only the `→ IDEA-n` bullets written by hand under it in
`ROADMAP.md`, while the *shipped* and *in queue* stamps on the same row
count the ideas whose `subject:` is the item — so Packaging shows an empty
bar beside *7 shipped*, Run & monitor shows a full bar over 27 of 30, and
thirteen of fifteen items show no progress at all. The status filter reads
the same links, so filtering by Done hides Packaging entirely.

**An item's ideas are one set.** `resolveRoadmap` resolves each item to the
entities whose `subject` equals its name, joined with its linked ids,
deduplicated by id. Dropped entities stay in the list and out of the
arithmetic: `rollup.total` counts the non-dropped, `rollup.done` the done,
and `rollup.open` the rest. `ResolvedRoadmapItem` carries that list as
`ideas`, each with id, title, status, `pr` and `released`; `links` and the
page's own `graduatedByItem` subject filter go, and every consumer — bar,
stamps, filters — reads `ideas`.

**An item has a state.** `shipped` when the item carries the shipped marker
[[IDEA-277]] writes; otherwise `not-started` with no non-dropped idea, and
`in-progress` with any. An item whose every idea is done but which is not
marked resolves `in-progress` with `readyToShip: true`, since a subject can
always take one more idea and only a person can say a bet is finished.

**The parser reads what the file says.** A link's id is its leading
`[A-Z]+-\d+` token, so `→ IDEA-118 (the pull side…)` resolves instead of
dying with its note attached — four links on two items are dead today. A
`  - ✓ shipped <date>` bullet parses into `shippedOn`. Each horizon keeps
the prose between its heading and its first item as `intro`.

**Standing concerns and the unfiled resolve too.** `ResolvedRoadmap` gains
`standingConcerns`, each resolved through the same subject join, and
`unfiled`: every entity whose subject is missing or names nothing on the
map, 73 of 279 today.

**Promote files the idea where it came from.** `/api/roadmap/promote`
defaults the new idea's subject to the item's name for an item as it
already does for a candidate, and `PromoteRoadmapItemModal` opens with
that subject selected in place of *No subject*.

**The dead weight goes.** `deriveRoadmapEvents`, `RoadmapEvent` and the
`events` field are computed on every load and rendered nowhere; they are
deleted with their tests.

### Out of scope

How the page looks, which is [[IDEA-276]]. Editing the file from the page,
which is [[IDEA-277]]. Assigning the 73 unfiled ideas a subject.

### Phases
- [x] Parse links, shipped markers and horizon intros
      Take a link's leading id token, read the `✓ shipped` bullet into `shippedOn`, and keep each horizon's leading prose as `intro`.
      run: 2m9s · 48 in · 9.3k out · sonnet-5 · sess:de9a5b6b-92ac-475e-a92e-7fcdbeded982
- [x] Resolve each item to one deduplicated idea set
      Join subject matches with linked ids, derive `rollup` from the non-dropped, and add the item state with `readyToShip`.
      run: 3m30s · 42 in · 16.2k out · sonnet-5 · sess:de9a5b6b-92ac-475e-a92e-7fcdbeded982
- [x] Resolve standing concerns and the unfiled
      run: 1m52s · 38 in · 6.7k out · sonnet-5 · sess:de9a5b6b-92ac-475e-a92e-7fcdbeded982
- [x] Delete the unused roadmap events
      Drop `deriveRoadmapEvents`, `RoadmapEvent`, the `events` field and their tests.
      run: 1m31s · 50 in · 5.7k out · sonnet-5 · sess:9d88bc89-7be4-41bc-bd10-82f5d1987553
- [ ] Read `ideas` in bar, stamps and filters
      Replace `links` and the page's `graduatedByItem` filter with the resolved list.
- [ ] Default a promoted idea's subject to its item
