---
id: IDEA-27
title: Content-hash audit freshness
type: feat
status: done
created: 2026-07-01
updated: 2026-07-03
tags:
  - audit
  - freshness
  - batch
---

Content-hash audit freshness: a stored hash of the plan at last audit replaces the same-day-blind mtime/date comparison.

### Phases
- [x] Add audited-hash to frontmatter schema
      Add an optional `audited-hash: string` field to `planFrontmatterSchema` in `src/core/schemas.ts` (`frontmatter-schemas.ts` is only a compatibility re-export shim; the schema itself lives in `schemas.ts`).
- [x] Implement hash computation helper
      Add a pure `computePlanContentHash(plan)` function that serialises phases + body prose, excluding `audited` and `audited-hash` fields, and returns a hex digest. Lives alongside the frontmatter helpers.
- [x] Update parser and serializer round-trip
      Ensure `parsePlanFile` (src/core/parser.ts) reads `audited-hash` and `formatPlanFile` (src/core/serializer.ts) writes it, and add the field to the shared `planFileInput` helper in `src/app/server/helpers.ts` so plan rewrites carry it. This must land before the stamp functions — they write through `formatPlanFile`/`planFileInput`, which would silently drop the field until it round-trips.
- [x] Thread hash through stamp functions
      Update `stampAuditDate` in `src/app/server/agent-hooks.ts` (moved there from api.ts when the server was split into modules) and `stampCliAuditDate` in `src/cli/index.ts` to compute and write `audited-hash` alongside the existing `audited: <date>` field (keep the date for human readability).
- [x] Replace freshness checks with hash comparison
      Update the two freshness-check call sites — the `plan.audited >= mtimeDate` comparisons in `startBatchAudit` in `src/app/server/agent.ts` (~line 396) and the audit-all loop in `src/cli/index.ts` (~line 394) — to skip a plan only when `plan['audited-hash']` exists and matches the recomputed hash.
- [x] Tests
      Add unit tests for `computePlanContentHash` (same-content stability, sensitivity to body/phase edits, insensitivity to audit-field changes) and integration tests for the skip/re-audit decision in both the agent and CLI paths.
