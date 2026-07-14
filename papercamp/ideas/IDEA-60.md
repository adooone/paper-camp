---
id: IDEA-60
title: Group code into domain subfolders
type: refactor
created: 2026-07-13
tags:
  - app
  - refactor
  - core
---

Several folders have gone flat and wide: `features/plans/components` holds 32 files, `core` 22, with `server/routes`, `services`, and `components` in the 10–13 range. A flat list that long stops communicating structure — you can't tell at a glance which files belong together. Reorganise so every folder keeps only a few anchor files at its top and pushes the rest into subfolders grouped by what the code *is about*.

- **Anchors stay at the top; everything else groups by domain.** Each feature/module folder keeps its `index.ts` barrel, its main entry (`{feature}.ts`/`{feature}-page.tsx`), styles, and a small number of directly-feature-wide files. The remaining files move into domain subfolders named for the logic they hold — e.g. `plans/components/` → `phases/`, `commit/`, `review/`, `agent/`, `idea/`; `core/` → `parse/`, `serialize/`, `git-pr/`, `status/`. The rule of thumb: once a folder passes ~8–10 files, group.
- **Barrels keep import paths stable.** Each new subfolder gets an `index.ts` and re-exports through the parent barrel, so consumers keep importing from `@/features/plans` — the move is internal, `@/` aliases and the "no `../../` deeper than one level" rule (`CODE_STYLE.md` §5) still hold.
- **Codify it in the style guide.** `CODE_STYLE.md` §4 currently prescribes a single flat `components/` per feature; update it to describe the anchors-plus-domain-subfolders layout and the soft file-count ceiling, so the structure doesn't re-flatten over time.

Complements [[IDEA-58]] (which de-dupes and splits oversized files) — grouping is most useful once that pass has decided what the units are, so run it alongside or just after. Structure-only: no behaviour change, and with barrels preserving the public import paths the check suite (`tsc`/`biome`/tests/consistency) is the acceptance gate.
