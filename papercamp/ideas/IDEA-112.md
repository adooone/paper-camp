---
id: IDEA-112
title: Move all styling to Tailwind
type: refactor
status: idea
created: 2026-07-30
updated: 2026-07-30
tags:
  - app
  - ui
  - refactor
subject: Simplicity pass
---

Styling is spread across four mechanisms — ~471 inline `style={{}}` objects, ~43 Tailwind classes, one global `utilities.css`, and paper-ui's CSS modules — so reading a component means checking several. Standardise on Tailwind utilities (paper-ui already ships the `paperPreset`, so the palette and spacing scale exist as classes).

The rules:

- Migrate every **static** inline `style={{}}` to Tailwind utility classes. Extend `tailwind.config.ts` only where a needed value isn't already in the preset.
- The **only** inline `style` that survives is a single genuinely runtime-dynamic property — a data-driven value Tailwind can't express, e.g. a `%` width/`left` computed from a rollup. Everything static becomes a class.
- Delete the `space`, `fontSize`, `radius`, `fontFamily`, and `layout` exports from `src/app/styles/tokens.ts` as their inline-style consumers move to classes; `tokens.ts` goes away entirely once `color` is gone too (see [[IDEA-111]]).
- `utilities.css` keeps only what utilities genuinely can't do: pseudo-elements, `[class*="…"]` overrides of paper-ui module classes, and media queries not expressible as Tailwind responsive variants.

Depends on [[IDEA-111]]: the CSS-var color classes must exist first, so the migration writes `text-accent-green` / `bg-canvas-300`, not fresh literals.

### Phases
- [x] Inventory the ~471 static inline `style={{}}` objects and map each value to a preset class
      Note the one genuinely runtime-dynamic property that stays inline; flag values with no matching class.
- [x] Extend `tailwind.config.ts` for the flagged values the preset doesn't cover
- [x] Migrate the static inline styles to Tailwind utility classes, subsystem by subsystem
      Write `text-accent-green` / `bg-canvas-300` against the [[IDEA-111]] color classes, never fresh literals.
- [x] Delete the `space`, `fontSize`, `radius`, `fontFamily`, and `layout` exports from `src/app/styles/tokens.ts`
      Retire `tokens.ts` entirely once `color` is gone too.
- [x] Trim `utilities.css` to only pseudo-elements, `[class*="…"]` module overrides, and non-variant media queries
- [ ] Type-check and full pass

### Thread
- [x] 2026-08-01 [log] [agent] Decision — checked every flagged inventory literal's RGB against `paperPreset` byte-for-byte; several "no preset match" calls in the phase-1 inventory were exact matches to an existing color at a non-default opacity, expressible with Tailwind's arbitrary-opacity modifier (`bg-watercolor-green/[18%]`, `bg-black/[8%]`) with no config extension: `diffAddedBg`/`diffRemovedBg` and their 0.3-alpha near-duplicates (→ `watercolor-green`/`watercolor-rose`), the `rgba(0,0,0,*)` black-overlay family (→ `black`), `rgba(26,25,23,0.4)` (→ `ink-900`), `rgba(61,53,43,0.12)` (→ `paper-950`). This also resolves the "reconcile the diff alphas?" flag — both alphas stay, applied to the same base color.
- [x] 2026-08-01 [log] [agent] Decision — `color.textProse` (`#1C1B18`) is 2 RGB units off `ink-900` (`#1A1917`), imperceptible; folded into `ink-900` rather than kept as a distinct token, per this repo's simplification bias. No config entry added for it.
- [x] 2026-08-01 [log] [agent] Added `desk.*`, `chalk.*` (lifted from `stack-panel/shared.ts`'s local `chalkStatusFill`/`chalkStatusText` — its `fail`/`running` text colors are the same values as the `stack-panel.tsx` glow-shadow literals, same family), `state.{success,danger}`, `fontSize` (9-step scale), and `borderRadius.{20,28}` to `tailwind.config.ts`. Left the `STATUS_STAMP`/`IDEA_STATUS_STAMP`/`PR_STATE_STAMP`/`REVIEW_DECISION_STAMP` enum maps in `features/plans/constants.ts` untouched — the phase-1 inventory already scoped that as a separate follow-up (possible replacement with paper-ui's `Stamp` component rather than more one-off colors), out of scope here. Full reasoning in `docs/tailwind-migration-inventory.md`'s "Phase 2 resolution" section.
