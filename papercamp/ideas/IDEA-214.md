---
id: IDEA-214
title: Inbox feature conventions pass
type: refactor
status: planned
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - code-health
  - inbox
subject: Code health
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/inbox` — 5 files,
242 lines. Below §4's grouping ceiling, so the flat layout stays; like issues
([[IDEA-213]]) the one violation is store coupling.

Measured violations (the §8 audit checklist):

- `inbox-page.tsx`: 6 `useAppStore` selectors plus 4 `useState`/`useEffect`
  occurrences (§4: components render, hooks decide).
- Everything else is clean: no inline props literals, no colour literals, no
  misplaced hooks, zero comments.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui. Restructuring into by-role folders — 5
files is below the §4 ceiling.

### Phases
- [ ] Extract a page hook for inbox-page
      Create `hooks/use-inbox-page.ts` owning the 6 store selectors, state and effects; `inbox-page.tsx` consumes exactly the data and callbacks it renders. The `hooks/` folder gets an `index.ts` barrel.
