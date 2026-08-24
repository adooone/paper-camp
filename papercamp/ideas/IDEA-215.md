---
id: IDEA-215
title: Docs feature conventions pass
type: refactor
status: planned
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - code-health
  - docs
subject: Code health
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/docs` — 7 files,
323 lines, already shaped like the §4 template (`components/`, `hooks/`,
barrels). One measured violation, and it is the single worst store coupling in
the app.

Measured violations (the §8 audit checklist):

- `components/docs-sidebar.tsx`: 12 `useAppStore` selectors — triple the ~4
  threshold (§4: components render, hooks decide).
- Everything else is clean: no inline props literals, no colour literals, no
  misplaced hooks, no duplicate imports, zero comments.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui.

### Phases
- [ ] Extract a hook for docs-sidebar
      Create `hooks/use-docs-sidebar.ts` owning the 12 store selectors and any derivation; `docs-sidebar.tsx` consumes exactly the data and callbacks it renders.
