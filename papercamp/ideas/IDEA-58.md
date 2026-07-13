---
id: IDEA-58
title: Simplify and de-dupe the codebase
type: refactor
created: 2026-07-13
tags:
  - app
  - refactor
  - core
---

Now that the feature set has landed, the code has accumulated the usual growth debt: repeated logic that predates its shared helper, files that have outgrown a single responsibility, dead exports, and a couple of import cycles. A focused pass to make the codebase smaller and easier to read — measured against `docs/CODE_STYLE.md`, which is already the yardstick (§3 "three copies means extract", §4 feature/service layering, §5 naming and the "no `../../` deeper than one level" rule).

- **Consolidate repeated logic into the helpers that should own it.** Concrete duplications spotted during the health scan: the check-status derivation (`qualityStatus`/`testStatus`/`consistencyStatus`) is copied between `status-bar.tsx` and `stack-panel.tsx`; the inline `WandIcon`/glyph SVGs are redefined per file; the `try/catch → toast → reload` action pattern is only partly factored (`usePlanStatusPatch` does it in some places, hand-rolled in others). Extract each to one home per §3, and prefer the existing helper over a new copy.
- **Split the files that have outgrown one responsibility.** `stack-panel.tsx` is ~1230 lines spanning Commit, Status/Findings, Agent log, and Activity — break it into per-section components under `components/` so each is readable in isolation, matching §4's feature-folder layout.
- **Prune the dead surface.** knip flags ~24 unused exports and a few unused symbols; remove the genuinely-dead ones, keeping the intentional public API of the `core`/`mcp` library entry points. Untangle the two `no-circular` warnings depcruise reports (`core/pr.ts ↔ core/readers.ts`, `services/docs-api.ts ↔ stores/app-store.ts`) so the dependency graph is acyclic.
- **Audit conformance to the style guide.** Sweep `src/app` for token literals that should come from `styles/tokens.ts`, raw HTML where a paper-ui component exists, and import paths that reach deeper than the guide allows — fixing or explicitly documenting each.

Pairs with [[IDEA-59]] (the comment-trimming pass), which is cleanest to run right after this so the surviving code is what gets its comments reviewed. Continues the direction of [[IDEA-47]] and [[IDEA-49]] (earlier UI-cleanup refactors), now extended past `src/app` into `core`. Purely internal — no behaviour or API changes, so the full check suite (`tsc`, `biome`, tests, consistency) is the acceptance gate.

### Phases
- [x] Extract the check-status derivation into one helper
      Pull the duplicated `qualityStatus`/`testStatus`/`consistencyStatus` logic out of `status-bar.tsx` and `stack-panel.tsx` into a single shared helper, and point both call sites at it (§3).
- [x] Consolidate the inline icon/glyph SVGs
      Move the per-file `WandIcon` and other redefined glyph SVGs into one icons module, and replace the local copies with imports.
- [x] Route the action pattern through `usePlanStatusPatch`
      Fold the hand-rolled `try/catch → toast → reload` call sites onto the existing `usePlanStatusPatch` helper so there's one owner of the pattern.
- [x] Split `stack-panel.tsx` into per-section components
      Break the ~1230-line file into Commit, Status/Findings, Agent-log, and Activity components under `components/`, matching §4's feature-folder layout, with `stack-panel.tsx` composing them.
- [x] Prune the dead exports knip flags
      Remove the genuinely-dead unused exports/symbols (~24), keeping the intentional public API of the `core`/`mcp` entry points; re-run knip to confirm.
- [ ] Untangle the two import cycles
      Break the `core/pr.ts ↔ core/readers.ts` and `services/docs-api.ts ↔ stores/app-store.ts` `no-circular` warnings so depcruise reports an acyclic graph.
- [ ] Sweep `src/app` for style-guide conformance
      Replace token literals with `styles/tokens.ts` values, swap raw HTML for the paper-ui component where one exists, and fix (or explicitly document) import paths that reach deeper than the guide allows.
