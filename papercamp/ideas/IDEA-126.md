---
id: IDEA-126
title: Read-only helper tasks silently supersede a running run-all
type: fix
status: review
created: 2026-08-04
tags:
  - agents
  - tasks
subject: Infrastructure
---

`registerTask` sets `state.lastLaunchedId` for **every** task kind, and `isSuperseded(task)` is just `lastLaunchedId !== task.id`. So the read-only helpers launched from the board — commit-suggest, feedback chat, overlap-check, prioritise (`runReadOnlyPrompt` → `registerAndStart`) — supersede a running run-all. The run-all then bails at its next checkpoint **silently**: no `[fail]`/`[verify]` lines, no thread escalation, `onRunComplete` never runs, and the task is finalized as `error`.

Observed in the func-ui corpus (run-all on its IDEA-2, claude-code): three runs "failed", yet every phase's work was complete, committed, and verified — the task lines simply stop at the agent's final summary. The operator was using the board (Suggest/Feedback) while runs executed, which is exactly the normal way to wait for a run. Presents to the user as "after every phase it fails."

Fix shape:

- Supersession should only apply **within exclusive task kinds** (run-all/phase/fix-review/sync/resolve-conflict): track `lastExclusiveLaunchedId` and compare against that, so read-only helpers can't evict a build.
- When supersession *is* legitimate, it must be loud and honest: push a `[superseded] …` line and finalize with outcome `superseded`, never `error`.

Related: the post-phase gate's check commands are hardcoded to this repo's stack (`npx vitest run`, `pnpm run consistency`) — in consumer repos they're permanently red and only survive via baseline tolerance. Per-project check config belongs to the run-&-monitor manifest ([[IDEA-119]]).

### Phases
- [x] Define the exclusive task-kind set
      Enumerate run-all/phase/fix-review/sync/resolve-conflict as the kinds that can supersede one another.
- [x] Track `lastExclusiveLaunchedId` on registration
      Set it only when an exclusive kind starts; leave it untouched for read-only helpers.
- [x] Gate `isSuperseded` on the exclusive id
      Compare against `lastExclusiveLaunchedId` so board helpers can no longer evict a running build.
- [x] Add a loud, honest `superseded` outcome
      Push a `[superseded] …` line and finalize legitimate supersession with outcome `superseded`, never `error`.
- [x] Verify with a run-all under board pressure
      Launch Suggest/Feedback helpers mid-run and confirm the run-all completes and never silently bails.
