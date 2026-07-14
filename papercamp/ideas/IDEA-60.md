---
id: IDEA-60
title: Group code into domain subfolders
type: refactor
created: 2026-07-13
tags:
  - app
  - refactor
  - core
status: review
---

Several folders have gone flat and wide: `features/plans/components` holds 32 files, `core` 22, with `server/routes`, `services`, and `components` in the 10–13 range. A flat list that long stops communicating structure — you can't tell at a glance which files belong together. Reorganise so every folder keeps only a few anchor files at its top and pushes the rest into subfolders grouped by what the code *is about*.

- **Anchors stay at the top; everything else groups by domain.** Each feature/module folder keeps its `index.ts` barrel, its main entry (`{feature}.ts`/`{feature}-page.tsx`), styles, and a small number of directly-feature-wide files. The remaining files move into domain subfolders named for the logic they hold — e.g. `plans/components/` → `phases/`, `commit/`, `review/`, `agent/`, `idea/`; `core/` → `parse/`, `serialize/`, `git-pr/`, `status/`. The rule of thumb: once a folder passes ~8–10 files, group.
- **Barrels keep import paths stable.** Each new subfolder gets an `index.ts` and re-exports through the parent barrel, so consumers keep importing from `@/features/plans` — the move is internal, `@/` aliases and the "no `../../` deeper than one level" rule (`CODE_STYLE.md` §5) still hold.
- **Codify it in the style guide.** `CODE_STYLE.md` §4 currently prescribes a single flat `components/` per feature; update it to describe the anchors-plus-domain-subfolders layout and the soft file-count ceiling, so the structure doesn't re-flatten over time.

Complements [[IDEA-58]] (which de-dupes and splits oversized files) — grouping is most useful once that pass has decided what the units are, so run it alongside or just after. Structure-only: no behaviour change, and with barrels preserving the public import paths the check suite (`tsc`/`biome`/tests/consistency) is the acceptance gate.

### Phases
- [x] Codify the layout rule in the style guide
      Rewrite `CODE_STYLE.md` §4 to replace the single flat `components/`-per-feature prescription with the anchors-plus-domain-subfolders layout: name the anchors that stay at the top (barrel, main entry, styles, feature-wide files), describe the domain-subfolder-with-barrel pattern, and state the soft ~8–10-file ceiling that triggers grouping. Do this first so later phases have a written target.
- [x] Group `features/plans/components` into domain subfolders
      Split the 32-file folder into domain subfolders (e.g. `phases/`, `commit/`, `review/`, `agent/`, `idea/`), leaving only the barrel/entry/styles and feature-wide files at the top. Give each subfolder an `index.ts` that re-exports through the parent barrel so `@/features/plans` import paths stay stable.
- [x] Group `core` into domain subfolders
      Split the 22-file `core` into domain subfolders (e.g. `parse/`, `serialize/`, `git-pr/`, `status/`) with per-subfolder barrels re-exported through the `core` barrel, keeping `@/core` consumers unchanged.
- [x] Group the remaining wide folders
      Apply the same anchors-plus-subfolders pass to `server/routes`, `services`, and `components` (each in the 10–13 range), grouping by domain and preserving import paths via barrels. Leave folders already under the ceiling alone.
- [x] Verify the check suite stays green
      Run `tsc --noEmit`, `biome`, tests, and the consistency check to confirm the reorg is behaviour-neutral and no import path drifted — the acceptance gate. Confirm the "no `../../` deeper than one level" rule (§5) still holds after the moves.
