---
id: IDEA-212
title: Stats feature conventions pass
type: refactor
created: 2026-08-24
updated: 2026-08-26
tags:
  - app
  - code-health
  - stats
subject: Code health
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/stats` — one
239-line `stats-page.tsx` plus a barrel, same single-file shape as tasks
([[IDEA-211]]).

Measured violations (the §8 audit checklist):

- `stats-page.tsx`: 239 lines with 6 `useState`/`useEffect` occurrences and at
  least one inline props type literal on an internal component (§4, §5).
- No colour literals, no comments, no duplicate imports — the split and the
  hook are the whole pass.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui.

### Phases
- [x] Split stats-page into views and a page hook
      Break `stats-page.tsx` into one-component-per-file `views/` files, extract a `hooks/use-stats-page.ts` owning the data fetching, state and effects, and give every component a named `{Component}Props` interface.
      run: 23s · 52 in · 13.6k out · sonnet-5
