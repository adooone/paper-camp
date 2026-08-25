---
id: IDEA-209
title: Roadmap feature conventions pass
type: refactor
status: planned
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - code-health
  - roadmap
subject: Code health
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/roadmap` —
7 files, 807 lines, half of them in one file. `roadmap-page.tsx` is the §8
outlier at 411 lines: 5 `useAppStore` selectors, 9 `useState`/`useEffect`
occurrences, an inline props type literal, and view components rendered inline
that belong in their own files.

Measured violations (the §8 audit checklist):

- `roadmap-page.tsx`: 411 lines mixing page wiring, row rendering and an
  inline props literal (§4 components-render-hooks-decide, §5 named props).
- `use-roadmap-item-names.ts` sits at the root instead of `hooks/` (§4).
- Both modals (`promote-roadmap-item-modal.tsx`, `add-roadmap-item-modal.tsx`)
  and the pure `roadmap-filters.ts` sit loose at the root instead of `modals/`
  and `helpers/` (§4).
- Two colour literals in `roadmap-page.tsx`: the highlight outline
  `rgba(200,154,90,0.5)` at line 201 and the stamp fill/text pair at line 231
  (§2). Per §8's known blocker they move into a feature `constants.ts` — the
  one sanctioned home — not into tokens, which wait on the paper-ui `-rgb`
  publish.
- `roadmap-sidebar.tsx` holds 4 selectors — at the threshold; it gets a hook
  in the same pass since the folder is being restructured anyway.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui. Tokenizing the colour literals (blocked on
the paper-ui `-rgb` publish, see CODE_STYLE §8).

### Phases
- [x] Split roadmap-page into views and a page hook
      Break the 411-line `roadmap-page.tsx` into one-component-per-file views under `views/`, extract a `hooks/use-roadmap-page.ts` owning its selectors, state and effects, and convert the inline props literal to a named interface. `roadmap-sidebar.tsx` gets its own hook in the same motion.
      run: 7m59s · 64 in · 21.9k out · sonnet-5
- [ ] Sort the remaining files into by-role folders
      `hooks/` takes `use-roadmap-item-names.ts`, `modals/` takes both modal files, `helpers/` takes `roadmap-filters.ts`; each folder gets an `index.ts` barrel and consumers import through it.
- [ ] Concentrate colour literals in constants.ts
      Create the feature's `constants.ts` and move the two raw `rgba()` values there as named constants — the sanctioned home per §8 — leaving no literal in a component file.
