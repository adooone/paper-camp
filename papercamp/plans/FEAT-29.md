---
id: FEAT-29
title: Content-hash audit freshness
kind: feat
status: in-progress
created: 2026-07-01
idea: IDEA-27
updated: 2026-07-02
tags:
  - audit
  - freshness
  - batch
---

FEAT-25's batch audit freshness check compares `audited >= mtimeDate` as `YYYY-MM-DD` strings, which fails when a plan is edited later the same day it was audited — both sides are equal so the edit is silently skipped. The obvious fix (full timestamps) is self-defeating: stamping `audited` is itself a write that bumps the file's mtime, so `audited` is always a moment *before* the new mtime and the plan would be re-audited on every run forever.

The correct fix is a content hash. After auditing, store `audited-hash` = a hash of the plan's meaningful content (phases + body, excluding the audit fields themselves). On subsequent runs, recompute the hash and skip only if it matches. Because the hash covers content rather than mtime, the stamp-write can't trip it, and real edits are detected regardless of when they happen. Existing plans with `audited` but no `audited-hash` are treated as needing audit so the hash gets populated on the first run through — a safe migration default.

### Phases
- [x] Add audited-hash to frontmatter schema
      Add an optional `audited-hash: string` field to `planFrontmatterSchema` in `src/core/schemas.ts` (`frontmatter-schemas.ts` is only a compatibility re-export shim; the schema itself lives in `schemas.ts`).
- [x] Implement hash computation helper
      Add a pure `computePlanContentHash(plan)` function that serialises phases + body prose, excluding `audited` and `audited-hash` fields, and returns a hex digest. Lives alongside the frontmatter helpers.
- [ ] Update parser and serializer round-trip
      Ensure `parsePlanFile` (src/core/parser.ts) reads `audited-hash` and `formatPlanFile` (src/core/serializer.ts) writes it, and add the field to the shared `planFileInput` helper in `src/app/server/helpers.ts` so plan rewrites carry it. This must land before the stamp functions — they write through `formatPlanFile`/`planFileInput`, which would silently drop the field until it round-trips.
- [ ] Thread hash through stamp functions
      Update `stampAuditDate` in `src/app/server/agent-hooks.ts` (moved there from api.ts when the server was split into modules) and `stampCliAuditDate` in `src/cli/index.ts` to compute and write `audited-hash` alongside the existing `audited: <date>` field (keep the date for human readability).
- [ ] Replace freshness checks with hash comparison
      Update the two freshness-check call sites — the `plan.audited >= mtimeDate` comparisons in `startBatchAudit` in `src/app/server/agent.ts` (~line 396) and the audit-all loop in `src/cli/index.ts` (~line 394) — to skip a plan only when `plan['audited-hash']` exists and matches the recomputed hash.
- [ ] Tests
      Add unit tests for `computePlanContentHash` (same-content stability, sensitivity to body/phase edits, insensitivity to audit-field changes) and integration tests for the skip/re-audit decision in both the agent and CLI paths.
