---
id: IDEA-32
title: Migrate to paper-ui 0.5.0
---

## IDEA-32: Migrate to paper-ui 0.5.0

paper-camp is pinned to `@dendelion/paper-ui: ^0.2.0` (0.2.0 installed); the library is now **0.5.0** — many new components, a rough.js restyle, and breaking API changes across 0.3–0.5. Bump to `^0.5.0` and adapt. Breakage below is measured against actual paper-camp usage, not hypothetical.

**Breaking changes to handle:**

1. **`variant="chalkboard"` → `surface="chalkboard"` — 20 occurrences, the bulk of the work.** 0.3.0 split the dark theme out of `variant` into a separate `surface?: 'paper' | 'chalkboard'` prop (confirmed on `Card` etc.). Every chalkboard usage (the Stack panel's "desk" theme) moves to `surface`. The other ~49 `variant=` usages are semantic Button/Alert values (`ghost`/`primary`/`secondary`/`link`/`error`/`warning`) and are **unaffected**.
2. **Alert is now compact single-line (0.5.0).** The `variant` values (`info`/`success`/`warning`/`error`) are retained, but the layout changed. paper-camp has 11 `<Alert>`, several with a `title` + multi-line body (e.g. "Couldn't load plans.md" + error text; the consistency-warnings list). Reflow those: keep terse messages as Alert; move rich/multi-line content to the new **Toast** or plain layout.
3. **`texture` prop** became `boolean | PaperTextureKey | TextureConfig` (0.3.0) on Card/Modal/Select/Page/Table — audit the few `texture=` usages and update any that passed the old shape.
4. **Font-size SCSS tokens renamed** (0.5.0: `-alt` tokens + `2xs` removed, scale shifted). paper-camp has its own `tokens.ts`, so this is a verify-only step: confirm the imported `dist` CSS still covers the classes paper-camp relies on; expect no code change.
5. **Badge merged into Stamp / removed** — paper-camp uses `Stamp`, never `Badge`, so **no action**.

**Scope boundary:** this idea is *only* the bump + keeping the app working on the new API. **Adopting** the new components 0.5.0 adds (Toast, Spinner, Skeleton, Tooltip, CopyButton, Divider, …) is tracked separately in [[IDEA-33]], which depends on this landing first. Keep this migration PR to "compiles and renders identically on 0.5.0" so it stays reviewable.

**Process (settled):**
- Bump `package.json` `^0.2.0` → `^0.5.0`, `pnpm install`. For co-dev use `pnpm link ../paper-ui` per AGENTS.md; paper-camp imports from `dist/`, so run `pnpm run build` in `~/dev/paper-ui` when linked.
- Verify with `tsc` **and a visual pass** — the `chalkboard`→`surface` sweep and the Alert reflow change rendering, so they need eyeballing in the running app (per AGENTS.md "verify UI changes visually"), not just a type-check.
- The chalkboard sweep (20) + Alert reflow (11) are the bulk — mechanical, but they change rendering so they must be checked visually, not just type-checked.
