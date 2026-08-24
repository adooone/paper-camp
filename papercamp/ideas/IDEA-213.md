---
id: IDEA-213
title: Issues feature conventions pass
type: refactor
status: planned
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - code-health
  - issues
subject: Code health
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/issues` — 4
files, 260 lines. Below §4's grouping ceiling, so the flat layout stays; the
one real violation is store coupling.

Measured violations (the §8 audit checklist):

- `issues-page.tsx`: 9 `useAppStore` selectors plus 4 `useState`/`useEffect`
  occurrences — more than double the ~4 threshold (§4: components render,
  hooks decide).
- Everything else is clean: no inline props literals, no colour literals, no
  misplaced hooks, one comment line.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui. Restructuring into by-role folders — 4
files is below the §4 ceiling and flat is the more readable choice.

### Phases
- [ ] Extract a page hook for issues-page
      Create `hooks/use-issues-page.ts` owning the 9 store selectors, state and effects; `issues-page.tsx` consumes exactly the data and callbacks it renders. The `hooks/` folder gets an `index.ts` barrel.
