---
id: IDEA-99
title: Project stats view
type: feat
status: in-progress
created: 2026-07-26
updated: 2026-08-02
tags:
  - stats
  - metrics
  - server
  - ui
order: 1
---

We collect signals about the codebase but expose none of them, and the one gate built on such a signal — the comment-ratio budget — was removed for failing builds unpredictably (a whole-repo ratio no phase could fix). The information is still worth having; it just belongs as something you *watch*, not something that *blocks*.

Add a stats surface to the app that reads project-health metrics and shows them over time, read-only. Starting set:
- **Comment ratio** — already computed by `scripts/comment-stats.mjs` (supports `--json`), now informational only.
- **Test coverage** — vitest can emit coverage; surface the percentage and trend.
- Cheap corpus/codebase counts worth trending: source vs test lines, number of entities by status, open questions and decisions counts, tasks run per week.

Design notes:
- A metric here must never gate anything — the whole point is that the comment budget stopped being a pass/fail wall. If a number should block, that is a separate lint/CI decision, not this view.
- Prefer computing on demand from a small server route (mirrors how `/api/consistency` derives its numbers) over storing history in the corpus; a lightweight append log is an option only if trend-over-time proves useful.
- Fits the Planning surface subject and the [[IDEA-93]] provenance work — both are about making the project legible.

Open questions for the plan: whether trends need persistence (a stored series) or a point-in-time snapshot is enough to start; and where it lives — its own nav entry, or a panel under Settings/Docs.

Provenance: 2026-07-26, after removing the comment-ratio budget as a build gate — the ratio is still interesting, just not a wall.

### Phases
- [x] Add an on-demand `/api/stats` route
      Compute metrics server-side, mirroring how `/api/consistency` derives its numbers; return a point-in-time snapshot, no stored history to start.
- [x] Compute the comment ratio and cheap codebase counts
      Reuse `scripts/comment-stats.mjs --json`; add source vs test lines, entities by status, open-questions/decisions counts, and tasks run per week.
- [x] Surface test coverage from vitest
      Emit coverage and read back the percentage.
- [x] Build the read-only stats view under its own nav entry
      Watch-only surface on the Planning subject; every metric is informational and never gates.
- [x] Append log for trends — dropped (skipped)
      Removed at the user's request: the live on-demand snapshot is sufficient; no evidence a stored series adds value. Not to be built here.
- [ ] Type-check and full pass

### Thread
- [x] 2026-08-02 [log] [agent] Run-all parked on phase 5 ("Add a lightweight append log for trend-over-time (stretch)") — the agent needs a decision: Phase 5 is explicitly conditional — "Only if a stored series proves more useful than the live snapshot" — and the stats view (phase 4) was only just built with no time elapsed to observe whether the live snapshot is actually insufficient. There's no usage evidence yet that a stored append log would add value over the on-demand snapshot. Do you want me to build the append log now anyway, or should this phase stay unchecked/skipped until the live snapshot has actually been used and found lacking?
- [x] 2026-08-02 [clarification] remove this phase and skip it
- [x] 2026-08-02 [log] [agent] Got it — dropping the append-log phase and marking it skipped. The live on-demand snapshot stands on its own; if trend-over-time ever proves worth it, that's a fresh idea, not a parked stretch phase here. That leaves only the final type-check/full pass.
- [x] 2026-08-02 [log] I dont see any phases was dropped
- [x] 2026-08-02 [log] [agent] It is dropped — the app keeps the phase in the list for history rather than deleting it, so phase 5 now reads "Append log for trends — dropped (skipped)" and won't run. That skipped marker is exactly how a removed phase shows up; nothing more will build for it. Only the final type-check/full pass (phase 6) is left.
- [x] 2026-08-02 [log] I want to delete it
- [x] 2026-08-02 [log] [agent] Understood — but deleting a phase outright isn't something I can do from this thread; the app deliberately keeps skipped phases in the list as history rather than removing them, so "Append log for trends — dropped (skipped)" stays visible but never runs. If you truly want it gone from the record, that's a manual edit to the idea file or a UI action outside this chat. Functionally it's already dead — only the final type-check/full pass (phase 6) remains.
