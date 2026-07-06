---
id: IDEA-21
title: Batch plan freshness audit
type: feat
status: done
created: 2026-06-30
updated: 2026-07-01
tags:
  - audit
  - convergence-audit
  - batch
  - cli
  - dashboard
---

The batch freshness audit: sweep every review/done plan through the convergence audit, skipping plans unchanged since their audited stamp.

### Phases
- [x] Add per-plan "last audited" marker
      Decide on a log line vs. a `**Audited:**` field; write it after each successful single-plan audit so the batch sweep has something to compare against. Update the AuditPhasesButton handler to stamp the marker on completion.
- [x] Implement `paper-camp audit` CLI command skeleton
      Register the `audit` subcommand; read the per-file plans under `papercamp/plans/` (incl. `archive/`) and collect every plan whose status is `review` or `done`. No AI calls yet — just print the list of plans that would be audited.
- [x] Wire convergence-audit logic into CLI loop
      For each collected plan, invoke the existing single-plan audit function (or its extracted core), skipping any plan whose "last audited" marker is newer than the plan's last modification. Append gap-phases to each plan's own file exactly as the single-plan path does.
- [x] Print combined CLI audit report
      After the loop completes, emit a structured summary: which plans were audited, which were skipped (up to date), and how many gap-phases were appended to each.
- [x] Add "Audit all" button to dashboard
      Surface the batch sweep in the Plans list or Stack panel UI; on click, run the same loop used by the CLI. Disable the button while a sweep is in progress.
- [x] Emit activity feed entries per plan touched
      For each plan the dashboard sweep modifies, create an activity entry recording how many phases were appended, so the feed reflects the audit without requiring the user to diff the plan files manually.
- [x] Add `POST /api/agent/launch-audit-all` API route and `batch-audit` task kind
      The dashboard "Audit all" button (Phase 5) must call a server endpoint — the CLI loop runs in-process, but the browser goes through HTTP. Add the route to trigger the batch sweep server-side, and add `'batch-audit'` to the `TaskKind` union so the status indicator and stop button correctly reflect a sweep in progress.

### Log
- 2026-07-01: missing server-side API route for dashboard batch sweep; added phase for `POST /api/agent/launch-audit-all` and `batch-audit` task kind
- 2026-07-01: phase 4 done — track `AuditResult[]` across the loop, count phases before/after each audit, print structured summary (audited/skipped/failed counts + per-plan gap-phase tally)
- 2026-07-01: phases 5 and 7 done together — `AuditAllButton` in plans-page.tsx header, `startBatchAudit` in AgentManager (sequential spawn loop with skip logic), `POST /api/agent/launch-audit-all` route, `batch-audit` TaskKind, Stack panel label; `TASK_KIND_TO_DEFAULT_KEY` updated in agents/index.ts
