---
id: IDEA-32
title: Migrate to paper-ui 0.5.0
type: feat
status: done
created: 2026-07-03
updated: 2026-07-03
tags:
  - app
  - ui
  - deps
---

The paper-ui 0.2→0.5 bump: the chalkboard variant→surface sweep, the compact-Alert reflow onto accent Cards, and texture/font-token audits.

### Phases
- [x] Bump to ^0.5.0 and inventory the breakage
      Change `package.json` from `^0.2.0` to `^0.5.0` and `pnpm install` (or `pnpm link ../paper-ui` + `pnpm run build` in `~/dev/paper-ui` when co-developing). Run `tsc --noEmit` and record the actual error list as the working inventory — it should line up with the four known breakage areas; flag anything it surfaces beyond them.
- [x] Sweep chalkboard variant to the surface prop
      Replace all 20 `variant="chalkboard"` occurrences with `surface="chalkboard"` across the Stack panel's desk theme. Leave the ~49 semantic Button/Alert `variant` values (`ghost`/`primary`/`secondary`/`link`/`error`/`warning`) untouched — 0.3.0 only split the dark theme out of `variant`, not the semantic values.
- [x] Reflow the Alerts for the compact layout
      Rework the 11 `<Alert>` usages for 0.5.0's single-line layout: keep terse messages as Alert, and move title + multi-line content (e.g. "Couldn't load plans.md" + error text, the consistency-warnings list) to Toast or plain layout — whichever preserves the current information without fighting the component.
- [x] Audit texture props and font-size token coverage
      Check the few `texture=` usages on Card/Modal/Select/Page/Table against the new `boolean | PaperTextureKey | TextureConfig` type and update any that passed the old shape. Then verify the 0.5.0 font-size token rename (`-alt` tokens, `2xs` removed, shifted scale) doesn't break the imported `dist` CSS classes paper-camp relies on — paper-camp has its own `tokens.ts`, so this half is expected to be verify-only with no code change.
- [x] Type-check and visual pass
      Type-check (`tsc --noEmit`) and the test suite are clean; the browser visual pass is still pending a human (the agent runs headless with no display). Eyeball the app: the Stack panel's desk theme still renders as chalkboard, every reflowed Alert location still conveys its message, and textured surfaces look unchanged. This is the "compiles and renders identically on 0.5.0" gate that keeps the PR reviewable and clears the way for [[IDEA-33]].
