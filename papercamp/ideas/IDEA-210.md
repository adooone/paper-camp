---
id: IDEA-210
title: Settings feature conventions pass
type: refactor
status: planned
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - code-health
  - settings
subject: Code health
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/settings` — the
heaviest remaining feature at 955 lines in 6 files, two of them outliers:
`settings-page.tsx` (406 lines, 9 `useState`/`useEffect`) and
`components/setup-section.tsx` (330 lines, 4 `useAppStore` selectors, an
inline props literal).

Measured violations (the §8 audit checklist):

- `settings-page.tsx`: 406 lines of page wiring plus rendering — the state
  machine belongs in a hook, the sections in `views/` files (§4).
- `setup-section.tsx`: 330 lines, store subscriptions, and an inline props
  type literal (§4, §5).
- Six colour literals (§2): the status map in `setup-section.tsx:109-111`
  (three fill/text/label entries), the stamp pair in
  `merge-policy-section.tsx:98-99`, and the fill in `settings-page.tsx:303`.
  These are the same green/amber/rose stamp values the plans feature keeps in
  its `constants.ts`; per §8's known blocker they concentrate into a settings
  `constants.ts`, not tokens.
- 8 comment lines to audit against §7.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui. Tokenizing the colour literals (blocked on
the paper-ui `-rgb` publish). Deduplicating stamp colours across features —
each feature's `constants.ts` stays self-contained until the token publish
makes the shared home a token, not another literal map.

### Phases
- [ ] Split settings-page and extract its hook
      Break `settings-page.tsx` into per-section `views/` files, with a `hooks/use-settings-page.ts` owning its state, effects and async handlers; the page composes views and renders what the hook returns.
- [ ] Give setup-section a hook and named props
      Extract `setup-section.tsx`'s store access and derivation into `hooks/use-setup-section.ts`, convert the inline props literal to a `{Component}Props` interface, and split the file if more than one component remains in it.
- [ ] Concentrate colour literals in constants.ts
      Create the feature's `constants.ts` and move all six raw values there as named maps (status stamp map, merge-policy pair, page fill) — no literal left in a component file.
- [ ] Audit every comment against §7
      Walk the 8 `//` lines: keep a one/two-line non-derivable why, delete the rest.
