---
id: IDEA-211
title: Tasks feature conventions pass
type: refactor
status: done
created: 2026-08-24
updated: 2026-08-26
tags:
  - app
  - code-health
  - tasks
subject: Code health
order: 1
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/tasks` — the
whole feature is one 281-line `tasks-page.tsx` plus a barrel, which is the "a
sections file is how a 900-line file starts" case (§5) caught early.

Measured violations (the §8 audit checklist):

- `tasks-page.tsx`: 281 lines with 9 `useState`/`useEffect` occurrences —
  page wiring, row rendering and highlight logic in one body (§4).
- Four colour literals (§2): the highlight outline `rgba(200,154,90,0.5)` at
  line 148 and the green/amber/rose stamp fills at lines 188-191. Per §8's
  known blocker they move to a feature `constants.ts`, not tokens.
- 3 comment lines to audit against §7.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui. Tokenizing the colour literals (blocked on
the paper-ui `-rgb` publish).

### Phases
- [x] Split tasks-page into views and a page hook
      Break `tasks-page.tsx` into one-component-per-file `views/` files (task row, list, any detail piece), with a `hooks/use-tasks-page.ts` owning the selectors, state and effects; folders get `index.ts` barrels.
      run: 6m55s · 54 in · 16.2k out · sonnet-5
- [x] Concentrate colour literals in constants.ts
      Create the feature's `constants.ts` and move the four raw `rgba()` values there as named constants; audit the 3 comment lines against §7 in the same motion.
      run: 5m18s · 48 in · 8.9k out · sonnet-5
