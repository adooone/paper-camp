---
id: IDEA-92
title: Timeline view and horizon lanes
type: feat
status: idea
created: 2026-07-25
updated: 2026-07-26
tags:
  - app
  - ui
  - core
  - roadmap
subject: Planning surface
order: 8
---

The roadmap reads as a static document rather than something you can see movement in, and it has two structural problems.

Layout: horizons are columns and the page width is already fully spent, so there is nowhere to put a fourth horizon and no room to show per-item progress. Flip horizons from columns to horizontal lanes — lanes scale to any number of horizons, give each item room for a title plus a rollup, and line up naturally with a left-to-right time axis.

Views: add modes over the same data — Tree (today's structure), Map, and a **Timeline** showing what actually happened when. The raw material already exists: entity `created`/`updated` dates, `tasks.log` run timestamps, and progress.md's dated entries.

This also settles where Horizon 4 goes. H1 is "ready for daily use", H2 "a deeper desk", H3 "beyond one desk" — but the tail items ("Project genesis", "The format as the product") are not beyond one desk, they are beyond Paper Camp: the format-and-ecosystem play. That is Horizon 4, and those two items move into it.

Depends on [[IDEA-91]]: without items surviving promotion there is no progress to visualise.

### Phases
- [ ] Add Horizon 4 and move the tail items into it
      Add a fourth horizon to `ROADMAP.md` (the format-and-ecosystem play) and move "Project genesis" and "The format as the product" out of their current horizon into it. Confirm `HORIZON_HEADING_RE` in `src/core/roadmap.ts` already parses `## Horizon 4 — …` so the new lane appears with no parser change.
- [ ] Flip the horizon layout from columns to horizontal lanes
      Rework the roadmap view so each horizon renders as a full-width horizontal lane rather than a column, scaling to any horizon count and giving each item room for a title plus its per-item rollup (from [[IDEA-91]]), laid out along a left-to-right axis.
- [ ] Add the Tree / Map / Timeline view-mode toggle
      A mode switch over the same roadmap data. Tree is today's structure reframed as the default mode; Map and Timeline are the new modes the switch selects between.
- [ ] Derive a dated event stream for the Timeline
      Collect events from each entity's `created`/`updated` dates, `tasks.log` run timestamps, and `progress.md`'s dated entries into one chronological model, keyed back to the roadmap item and entity each belongs to.
- [ ] Build the Timeline view
      Render the derived event stream along the lanes' time axis — what actually happened when — so movement against each horizon is visible rather than a static structure.
- [ ] Build the Map view
      Render the Map mode over the same roadmap data.
- [ ] Type-check and full pass
      `pnpm run check-types`, `npx biome check . --write`, and `pnpm test` clean across the repo.
