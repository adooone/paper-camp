---
id: FEAT-34
title: Migrate to paper-ui 0.5.0
kind: feat
status: in-progress
created: 2026-07-03
idea: IDEA-32
updated: 2026-07-03
tags:
  - app
  - ui
  - deps
---

paper-camp is pinned to `@dendelion/paper-ui ^0.2.0` while the library is now at 0.5.0, with a rough.js restyle and breaking API changes accumulated across 0.3–0.5. This plan is the bump plus the minimum adaptation to keep the app compiling and rendering identically on the new API — measured against actual usage, the breakage is: 20 `variant="chalkboard"` occurrences (the Stack panel's "desk" theme) that move to the new `surface="chalkboard"` prop introduced when 0.3.0 split the dark theme out of `variant`; 11 `<Alert>` usages that must be reflowed because 0.5.0 made Alert a compact single-line component (the `info`/`success`/`warning`/`error` variants survive, but title + multi-line bodies no longer fit); a small audit of `texture=` props against the widened `boolean | PaperTextureKey | TextureConfig` type; and a verify-only check that the 0.5.0 font-size token rename doesn't affect the `dist` CSS classes paper-camp relies on. The other ~49 semantic Button/Alert `variant` values are unaffected, and Badge→Stamp is a no-op since paper-camp only ever used `Stamp`.

Scope is deliberately tight: adopting the new 0.5.0 components (Toast, Spinner, Skeleton, Tooltip, CopyButton, Divider, …) is tracked separately in [[IDEA-33]] and depends on this landing first — the one exception is that Alert content which genuinely can't survive the compact layout may move to Toast or plain layout, since that's forced by the breakage, not adoption for its own sake. Because the chalkboard sweep and the Alert reflow both change rendering, verification is `tsc` **plus a visual pass** in the running app (per AGENTS.md "verify UI changes visually"), not just a type-check. For co-development against a local library checkout, use `pnpm link ../paper-ui` per AGENTS.md and run `pnpm run build` there, since paper-camp imports from `dist/`.

### Phases
- [x] Bump to ^0.5.0 and inventory the breakage
      Change `package.json` from `^0.2.0` to `^0.5.0` and `pnpm install` (or `pnpm link ../paper-ui` + `pnpm run build` in `~/dev/paper-ui` when co-developing). Run `tsc --noEmit` and record the actual error list as the working inventory — it should line up with the four known breakage areas; flag anything it surfaces beyond them.
- [x] Sweep chalkboard variant to the surface prop
      Replace all 20 `variant="chalkboard"` occurrences with `surface="chalkboard"` across the Stack panel's desk theme. Leave the ~49 semantic Button/Alert `variant` values (`ghost`/`primary`/`secondary`/`link`/`error`/`warning`) untouched — 0.3.0 only split the dark theme out of `variant`, not the semantic values.
- [x] Reflow the Alerts for the compact layout
      Rework the 11 `<Alert>` usages for 0.5.0's single-line layout: keep terse messages as Alert, and move title + multi-line content (e.g. "Couldn't load plans.md" + error text, the consistency-warnings list) to Toast or plain layout — whichever preserves the current information without fighting the component.
- [x] Audit texture props and font-size token coverage
      Check the few `texture=` usages on Card/Modal/Select/Page/Table against the new `boolean | PaperTextureKey | TextureConfig` type and update any that passed the old shape. Then verify the 0.5.0 font-size token rename (`-alt` tokens, `2xs` removed, shifted scale) doesn't break the imported `dist` CSS classes paper-camp relies on — paper-camp has its own `tokens.ts`, so this half is expected to be verify-only with no code change.
- [ ] Type-check and visual pass
      Run `tsc --noEmit` clean, then eyeball the app: the Stack panel's desk theme still renders as chalkboard, every reflowed Alert location still conveys its message, and textured surfaces look unchanged. This is the "compiles and renders identically on 0.5.0" gate that keeps the PR reviewable and clears the way for [[IDEA-33]].
