---
id: IDEA-69
title: Slim the codebase for release
type: refactor
status: idea
created: 2026-07-17
updated: 2026-07-18
tags:
  - app
  - core
  - cli
  - refactor
subject: Code health
order: 3
---

Full-code simplification pass before the next release: minimal, clean source with no behaviour change. [[IDEA-63]] already swept comments to 2.8%; this is the same discipline applied to the code itself. Non-test `src/` sits at **17,584 lines**, and the mass is concentrated the same way the comments were:

- `server/agent.ts` **1148** — task registry, write-set gate, ~8 launch modes, fix-review settle, persistence, and kill logic in one file. The launch modes share one scaffold (admit → register → spawn → parse lines → finish) that is re-spelled per mode.
- `features/settings/settings-page.tsx` **668** and `components/stack-panel/commit-section.tsx` **523** (21 hooks) — the two biggest components; commit-section carries file list, commit form, push, sync, and pull in one body.
- `cli/index.ts` **642** — monolithic command dispatch.
- `core/parse/parser.ts` **560** + `core/serialize/serializer.ts` **418** — a round-trip pair with mirrored, separately-spelled section handling.
- `stores/app-store.ts` **539** — a dozen load-slices all hand-writing the same loading/error/set pattern.
- `core/git-pr/pr.ts` + `pr-lookup.ts` **770 combined, 15 exports** — surface wider than its callers.

Rules of the pass: no behaviour change (tests are the gate, and they stay — 5,203 test lines are the safety net, not a target); minimal ≠ clever — prefer deleting and merging over abstracting, and only extract a helper where the same shape is spelled ≥3 times (§ "3 copies = extract"); don't re-grow the comment debt [[IDEA-63]] just paid down. **Sequence after [[IDEA-68]]** — it deletes whole UI surfaces (settings sections, three docs views), and simplifying code that's about to be removed is wasted motion.

Honesty mechanism, same as IDEA-63: baseline first, report per-file before/after line counts each phase, and gate on the total. If the number didn't move, the pass didn't happen.

### Phases
- [x] Baseline and dead-code inventory
      Record per-file line counts across non-test `src/` (the hotspots above and the 17,584 total) and inventory unused/under-used exports (git-pr's 15, store selectors, route helpers) so later phases diff against fixed numbers and deletions are provable.
- [x] Split and shrink server/agent.ts
      Extract the shared launch scaffold the ~8 modes re-spell, and move fix-review settle + task-log persistence into their own modules; the registry/gate stays the core. Report before/after (1148 → n).
- [x] Slim the client hotspots
      `commit-section.tsx`: split file-list / commit-form / branch-actions and cut the 21-hook body down; `app-store.ts`: collapse the repeated load-slice pattern into one factory; sweep `entity-detail.tsx` (420) and `worklist-rows.tsx` (313) with the same eye. Settings-page is expected to shrink via IDEA-68 first — only slim what remains.
- [ ] Tighten the core round-trip and git-pr surface
      `parser.ts`/`serializer.ts`: merge the mirrored per-section handling so one table drives both directions where possible; `pr.ts`/`pr-lookup.ts`: cut the export surface to what callers use and fold single-caller helpers in. Report per-file.
- [ ] Slim the CLI and MCP layer
      `cli/index.ts`: table-drive the command dispatch; `mcp/tools.ts`: dedupe wrappers that re-spell server reads. Report per-file.
- [ ] Gate and report the release numbers
      `tsc --noEmit`, `biome check`, full tests green; total before/after line count across `src/`, per-file for every touched hotspot, and confirmation the comment ratio stayed at IDEA-63's level.
