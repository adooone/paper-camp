---
id: IDEA-107
title: De-complicate the worst code
type: refactor
status: idea
created: 2026-07-29
updated: 2026-07-29
tags:
  - app
  - core
  - server
subject: Simplicity pass
---

A legibility pass over the worst duplication and over-abstraction (from the audit), no behaviour change, tests stay green. Ranked by payoff:

- `server/routes/agent.ts` — ~10 handlers repeat parse→validate→404→409→202; extract a `planActionRoute` factory.
- `stores/app-store.ts` — one 700-line store + ~9 identical launch thunks; split into per-domain slices + a launch helper.
- `server/agent.ts` — `startBatchReconcile`/`startRunAllPhases` are ~120-line twins; share a `runPhaseProcess()`; replace `finishTask`'s 8-branch ternary with a table.
- `core/serialize/serializer.ts` — 4 near-identical `format*` builders; one section-appender over a shared field list.
- `core/roadmap.ts` — 4 mutators re-scan for the item; one `locateItem()` with thin splices on top.
- Extract components from `status-section.tsx` (270-line render) and the inline blocks in `entity-detail.tsx`; generic parse loop in `parser.ts`; `spawnJson` helper in `pr-lookup.ts`.

### Phases
- [x] Extract a `planActionRoute` factory in `server/routes/agent.ts`
      Fold the repeated parse→validate→404→409→202 across the ~10 handlers into one factory.
- [x] Split `stores/app-store.ts` into per-domain slices with a launch helper
      Break up the 700-line store and collapse the ~9 identical launch thunks.
- [x] Share a `runPhaseProcess()` and table-drive `finishTask` in `server/agent.ts`
      Merge the `startBatchReconcile`/`startRunAllPhases` twins; replace the 8-branch ternary with a lookup table.
- [x] Collapse the `format*` builders in `core/serialize/serializer.ts`
      One section-appender over a shared field list in place of the 4 near-identical builders.
- [ ] Add `locateItem()` to `core/roadmap.ts`
      Replace the 4 mutators' repeated scans with one locator and thin splices.
- [ ] Extract UI components and the smaller helpers
      Split `status-section.tsx` and the inline blocks in `entity-detail.tsx`; add the generic parse loop in `parser.ts` and the `spawnJson` helper in `pr-lookup.ts`.
- [ ] Type-check and full pass
      Confirm no behaviour change and all tests stay green.
