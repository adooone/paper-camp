---
id: IDEA-111
title: Adopt paper-ui color tokens, drop local literals
type: refactor
status: dropped
created: 2026-07-30
updated: 2026-07-31
tags:
  - app
  - ui
  - refactor
subject: Simplicity pass
---

The paper-camp app duplicates every color — a hand-typed `color` object in `src/app/styles/tokens.ts` plus ~47 raw `#hex`/`rgba()` literals inline in TSX — drifting from paper-ui's real tokens. The same accent green is `#8FB996` here and `rgba(143,185,150,0.25)` there, with no shared name, which is why picking "the green" keeps going wrong.

The single-source fix lives in **paper-ui**: the palette becomes `--pui-color-*-rgb` channel custom properties, with the scss tokens and Tailwind preset deriving from them (settled as option (c) — see Log). That work is done in the paper-ui repo and ships as a version bump. It is a **precondition** for this plan, not part of it: publishing paper-ui is a manual cross-repo release the maintainer owns, and a push + irreversible npm publish is deliberately kept out of run-all.

This plan is the **paper-camp side only**: once the new paper-ui is published, consume it and delete paper-camp's own color duplication, so no hand-typed color literal remains in the app.

Result: one place to define or retheme any color, no duplicate-hex drift. Foundation for [[IDEA-112]] — do this before the Tailwind migration so the color classes/vars exist.

### Phases
- [ ] Bump paper-camp's paper-ui dependency to the published `--pui-color-*-rgb` version
      Precondition: paper-ui is published with the channel tokens. Update the dependency and confirm the new tokens/classes resolve.
- [ ] Inventory the ~47 inline `#hex`/`rgba()` literals in paper-camp TSX
      Map each to the matching token/class or alpha variant before touching code.
- [ ] Replace every inline literal with a Tailwind class or `[…:var(--pui-color-…)]`
- [ ] Delete the `color` export from `src/app/styles/tokens.ts`
- [ ] Type-check and full pass

### Thread
- [x] 2026-07-31 [log] Run-all parked on phase 2 ("Point paper-ui's scss tokens and Tailwind preset at the vars") — the agent needs a decision: For the accent/chalkboard/canvas colors that are consumed via `rgba($color-x, alpha)` in component internals (and via Tailwind opacity modifiers in paper-camp), should phase 2 (a) leave those specific tokens as literal Sass/Tailwind values for now and only var()-ify tokens with no such usage (bg/text/border/surface bases), (b) go all-in on var() and accept fixing every affected `rgba()` call site and opacity-modifier usage as part of this same phase (much larger than "point tokens at vars"), or (c) switch the underlying `--pui-color-*` custom properties to store raw `R, G, B` triplets instead of hex so `rgba(var(--x), alpha)` and Tailwind's opacity closures keep working?
- [x] 2026-07-31 [log] Run-all parked on phase 2 ("Point paper-ui's scss tokens and Tailwind preset at the vars") — the agent needs a decision: For tokens consumed via `rgba($color-x, alpha)` in paper-ui internals and via Tailwind opacity modifiers in paper-camp, should phase 2 (a) leave those specific tokens as literal Sass/Tailwind values and only var()-ify tokens with no such usage, (b) go all-in on var() and fix every affected rgba()/opacity-modifier call site in this same phase, or (c) switch the underlying `--pui-color-*` custom properties to raw `R, G, B` triplets so `rgba(var(--x-rgb), alpha)` and Tailwind's opacity-modifier syntax keep working?
- [x] 2026-07-31 [log] Please choose which approach is the best for us
- [x] 2026-07-31 [log] Run-all parked on phase 2 ("Point paper-ui's scss tokens and Tailwind preset at the vars") — the agent needs a decision: For the `$color-sketch-stroke`/`-strong`/`-stronger`/`-active`/`-muted` tokens (currently `rgba($color-sketch-ink, alpha)`), should phase 2 (a) leave `$color-sketch-ink` as a literal hex (not var-ified) so these derived tokens keep working, accepting that one token stays outside the CSS-var seam for now, or (c) switch `--pui-color-sketch-ink` to store a raw `R, G, B` triplet so these become `rgba(var(--pui-color-sketch-ink-rgb), alpha)`? All other tokens have no such dependency and can point straight at their `var(--pui-color-*)` with no complication either way.
- [x] 2026-07-31 [log] Decision — go with option (c) for every color token, none left outside the seam. Store each palette entry as space-separated RGB channels in a `--pui-color-*-rgb` custom property (e.g. `--pui-color-accent-green-rgb: 143 185 150`) declared in `globals.scss`, and derive the solid token from it: `$color-accent-green: rgb(var(--pui-color-accent-green-rgb))` and `colors['accent-green'] = 'rgb(var(--pui-color-accent-green-rgb) / <alpha-value>)'` in the Tailwind preset. Rewrite the `rgba($color-x, alpha)` internals (including all `$color-sketch-*` derived from `$color-sketch-ink`, and the accent/chalkboard/canvas alpha variants) to `rgb(var(--pui-color-x-rgb) / <alpha>)`, and the named alpha variants (`--pui-color-accent-green-25`, `-30`) become `rgb(var(--pui-color-accent-green-rgb) / 25%)` etc. This is the one form that keeps solid use, `rgba()` internals, and Tailwind opacity modifiers all reading from a single source. Proceed on this basis.
- [x] 2026-07-31 [log] Re-scoped — the paper-ui token work (former phases 1–2) and its release (former phase 3) are moved out of this plan. They are paper-ui repo work plus a manual cross-repo push + npm publish, which run-all cannot and should not do. Those code changes are already made locally in paper-ui; the maintainer drives sync-with-origin → commit → push → merge the release-please PR → publish. This plan now covers only the paper-camp consumption + literal cleanup, with "paper-ui published with the `--pui-color-*-rgb` tokens" as its precondition.
- [x] 2026-07-31 [log] Run-all parked on phase 1 ("Bump paper-camp's paper-ui dependency to the published `--pui-color-*-rgb` version") — the agent needs a decision: paper-ui's `--pui-color-*-rgb` token work exists only as uncommitted local changes in `~/dev/paper-ui` (not committed, not pushed, not published) — the latest version on npm is still `0.8.0` with no `-rgb` tokens. This phase's precondition ("paper-ui is published with the channel tokens") isn't met yet. Do you want me to wait until you've committed/pushed/published paper-ui, or is there a different published version/tag I should point the dependency at?
