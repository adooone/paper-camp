---
id: IDEA-27
title: Content-hash freshness for batch audit
---

## IDEA-27: Content-hash freshness for batch audit

FEAT-25's batch audit skips plans that are "up to date" since their last audit, but the freshness check is day-granularity and wrong for same-day edits. Both call sites compare `plan.audited >= mtimeDate` where each side is a `YYYY-MM-DD` string:
- `src/app/server/agent.ts` (the batch loop, ~line 372)
- `src/cli/index.ts` (the `paper-camp audit` loop, ~line 374)

If a plan is audited and then edited **later the same day**, `mtimeDate === plan.audited`, so `audited >= mtimeDate` is true and the edit is skipped. CodeRabbit flagged both as Major.

**Why the obvious fix (full timestamps) is itself broken.** Stamping the `audited` field *is a write* — it bumps the plan file's mtime. So with full timestamps, `audited` is always a moment *before* the resulting mtime, making `audited >= mtime` permanently false → the plan would be re-audited **every run**, forever. Day-granularity only "works" because the stamp-write and the audit land on the same date.

**Correct approach — content hash.** Stamp an `audited-hash` = hash of the plan's *meaningful* content (phases + body, excluding the audit fields themselves). On the next run, recompute the hash of the current plan and skip only if it matches. This ignores mtime entirely, so the stamp-write can't trip it, and it detects real edits regardless of same-day timing.

**Touchpoints:**
- Frontmatter schema (`src/core/frontmatter-schemas.ts`) — add an optional `audited-hash` field.
- Serializer/parser (`formatPlanFile` / `parsePlanFile`) — write and read it.
- The two stamp functions — `stampAuditDate` (`api.ts`) and `stampCliAuditDate` (`cli/index.ts`) — compute and store the hash alongside the existing `audited: <date>` (keep the date for human display).
- The two freshness checks (agent.ts + cli) — compare hashes instead of dates.
- Migration: existing plans have `audited` but no hash → treat "no hash" as "needs audit" so the hash gets populated on the next run (safe default).

**Alternative considered:** store the audit stamp *outside* the plan file (a sidecar or a central audit index) so stamping never touches the plan's mtime — then a plain `mtime <= audited-timestamp` comparison is correct. Cleaner conceptually but adds a new storage location; the in-frontmatter hash keeps everything in one file. Decide during the build. Surfaced reviewing [[IDEA-21]] (FEAT-25).
