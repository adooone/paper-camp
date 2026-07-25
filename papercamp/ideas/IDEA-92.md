---
id: IDEA-92
title: Timeline view and horizon lanes
status: idea
created: 2026-07-25
updated: 2026-07-25
---

The roadmap reads as a static document rather than something you can see movement in, and it has two structural problems.

Layout: horizons are columns and the page width is already fully spent, so there is nowhere to put a fourth horizon and no room to show per-item progress. Flip horizons from columns to horizontal lanes — lanes scale to any number of horizons, give each item room for a title plus a rollup, and line up naturally with a left-to-right time axis.

Views: add modes over the same data — Tree (today's structure), Map, and a **Timeline** showing what actually happened when. The raw material already exists: entity `created`/`updated` dates, `tasks.log` run timestamps, and progress.md's dated entries.

This also settles where Horizon 4 goes. H1 is "ready for daily use", H2 "a deeper desk", H3 "beyond one desk" — but the tail items ("Project genesis", "The format as the product") are not beyond one desk, they are beyond Paper Camp: the format-and-ecosystem play. That is Horizon 4, and those two items move into it.

Depends on [[IDEA-91]]: without items surviving promotion there is no progress to visualise.
