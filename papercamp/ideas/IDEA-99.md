---
id: IDEA-99
title: Project stats view
status: idea
created: 2026-07-26
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
