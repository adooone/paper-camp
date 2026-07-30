---
id: IDEA-91
title: Roadmap items survive promotion
type: feat
status: done
created: 2026-07-25
updated: 2026-07-29
tags:
  - roadmap
  - core
  - app
  - ui
subject: Planning surface
order: 6
---

Promoting a roadmap item **deletes it**. `POST /api/roadmap/promote` calls `removeRoadmapItem(...)` and rewrites `ROADMAP.md` (`src/app/server/routes/content/ideas.ts`), mirroring the suggestions-promote flow. That shape is right for a suggestion, which is disposable, and wrong for a roadmap item, which is the thing we steer by: the moment real work starts on something it vanishes from the map, and there is no way to see progress against the plan we set ourselves.

The roadmap is currently modelled as a queue you consume rather than a map you track. Change promotion to **link instead of delete**: the item stays in `ROADMAP.md` and gains a reference to the entity it minted. The roadmap can then resolve each item to its ideas and roll their statuses up into per-item and per-horizon progress.

This is roughly one route change plus one format change, and it is the precondition for every other roadmap improvement — land it before [[IDEA-92]] and [[IDEA-93]], both of which need items that persist in order to have anything to show.

### Phases
- [x] Choose the link grammar and extend the roadmap model
      Decide how a minted entity id is written under an item in `ROADMAP.md` — a sub-bullet distinct from the existing candidate bullets (both are indented `  - `, so the link needs an unambiguous marker, e.g. `  - → IDEA-N` or `  - [[IDEA-N]]`) that `parseItems` can tell apart from a candidate. Add a `linked: string[]` (entity ids) field to `RoadmapItem` in `src/types/index.ts`.
- [x] Parse and write links in `src/core/roadmap.ts`
      Teach `parseRoadmap`/`parseItems` to read the link marker into `linked` while leaving `candidates` untouched, and add a `linkRoadmapItem(markdown, horizonTitle, itemName, entityId)` helper that appends the link bullet in place — mirroring `addRoadmapCandidate`'s parse-splice-write grammar so the round trip stays stable. Cover both in `src/core/roadmap.test.ts`.
- [x] Change `POST /api/roadmap/promote` to link instead of delete
      In `src/app/server/routes/content/ideas.ts`, replace the `removeRoadmapItem(...)` call with `linkRoadmapItem(...)`, and require its 404/no-match guard to pass before minting an id or writing the idea file — a failed link must not leave an orphaned idea absent from `ROADMAP.md`. Only once the link succeeds does the route mint the entity, write both files, and regenerate indexes. Decide and document whether a candidate promotion keeps consuming the candidate bullet (queue shape) or also survives-and-links (map shape) — the item itself must stay either way.
- [x] Resolve items to ideas and roll up progress
      Add a core resolver that joins each item's `linked` ids to their entities' (derived) statuses and computes a per-item and per-horizon rollup, exposed through the roadmap read (`src/app/server/routes/reads.ts`). This is the data [[IDEA-92]]'s lanes and [[IDEA-93]]'s trail consume — build the model here, not the visualisation.
- [x] Surface links and rollup in the roadmap view
      Show each item's linked ideas and its progress rollup in `src/app/features/roadmap/roadmap-page.tsx` — a minimal per-item indicator, leaving richer timeline/lane layout to [[IDEA-92]]. Confirm the promote modal still reads correctly now that promotion no longer removes the item.
- [x] Type-check and full pass
      `pnpm run check-types`, `npx biome check . --write`, and `pnpm test` clean across the repo.

### Notes
- [x] [body] [decision] Roadmap links a minted entity with a `→ IDEA-N` sub-bullet
- [x] [body] [decision] Candidate promotion consumes the candidate bullet but still links the item
