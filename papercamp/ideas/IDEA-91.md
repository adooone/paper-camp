---
id: IDEA-91
title: Roadmap items survive promotion
status: idea
created: 2026-07-25
updated: 2026-07-25
---

Promoting a roadmap item **deletes it**. `POST /api/roadmap/promote` calls `removeRoadmapItem(...)` and rewrites `ROADMAP.md` (`src/app/server/routes/content/ideas.ts`), mirroring the suggestions-promote flow. That shape is right for a suggestion, which is disposable, and wrong for a roadmap item, which is the thing we steer by: the moment real work starts on something it vanishes from the map, and there is no way to see progress against the plan we set ourselves.

The roadmap is currently modelled as a queue you consume rather than a map you track. Change promotion to **link instead of delete**: the item stays in `ROADMAP.md` and gains a reference to the entity it minted. The roadmap can then resolve each item to its ideas and roll their statuses up into per-item and per-horizon progress.

This is roughly one route change plus one format change, and it is the precondition for every other roadmap improvement — land it before [[IDEA-92]] and [[IDEA-93]], both of which need items that persist in order to have anything to show.
